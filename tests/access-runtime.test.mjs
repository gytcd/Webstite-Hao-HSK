import {test, before} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare, Response as RuntimeResponse} from 'miniflare';

const settings = {ACCESS_TEAM_DOMAIN: 'hsk-runtime-tests.cloudflareaccess.com', ACCESS_AUD: 'a'.repeat(64)};
const encode = value => Buffer.from(value).toString('base64url');
let jwk, assertion;
before(async () => {
  const pair = await crypto.subtle.generateKey({name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'}, true, ['sign', 'verify']);
  jwk = {...await crypto.subtle.exportKey('jwk', pair.publicKey), kid: 'runtime-key', alg: 'RS256', use: 'sig'};
  const seconds = Math.floor(Date.now() / 1000);
  const header = encode(JSON.stringify({alg: 'RS256', kid: jwk.kid}));
  const claims = encode(JSON.stringify({iss: 'https://' + settings.ACCESS_TEAM_DOMAIN, aud: [settings.ACCESS_AUD], sub: 'runtime-user', email: 'runtime@example.com', iat: seconds, exp: seconds + 3600}));
  const payload = header + '.' + claims;
  assertion = payload + '.' + encode(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(payload)));
});

async function runtime(outboundService) {
  const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  return new Miniflare({
    compatibilityDate: config.compatibility_date,
    bindings: settings,
    modules: [
      {type: 'ESModule', path: 'runtime-worker.mjs', contents: `
        import {createAccessVerifier} from './lib/access-auth.mjs';
        const verify = createAccessVerifier();
        export default {async fetch(request, env) {
          const diagnostics = {};
          const user = await verify(request, env, {diagnostics});
          return Response.json({user, diagnostics}, {status: user ? 200 : 401});
        }};
      `},
      {type: 'ESModule', path: 'lib/access-auth.mjs', contents: await readFile(new URL('../lib/access-auth.mjs', import.meta.url), 'utf8')}
    ],
    outboundService
  });
}

test('Workers runtime loads signing keys and verifies header and cookie sessions', async () => {
  let calls = 0;
  const mf = await runtime(request => {
    calls++;
    assert.equal(request.url, 'https://' + settings.ACCESS_TEAM_DOMAIN + '/cdn-cgi/access/certs');
    assert.equal(request.headers.get('cookie'), null);
    assert.equal(request.headers.get('cf-access-jwt-assertion'), null);
    return RuntimeResponse.json({keys: [jwk]});
  });
  try {
    const header = await mf.dispatchFetch('https://hao.test/', {headers: {'cf-access-jwt-assertion': assertion}});
    const a = await header.json();
    assert.equal(header.status, 200, JSON.stringify(a.diagnostics));
    assert.equal(a.user.email, 'runtime@example.com');
    const cookie = await mf.dispatchFetch('https://hao.test/', {headers: {cookie: 'CF_Authorization=' + assertion}});
    const b = await cookie.json();
    assert.equal(cookie.status, 200, JSON.stringify(b.diagnostics));
    assert.equal(a.user.userId, b.user.userId);
    assert.equal(calls, 1);
  } finally {
    await mf.dispose();
  }
});

test('Workers runtime rejects signing-key redirects without requesting their destination', async () => {
  const requests = [];
  const mf = await runtime(request => {
    requests.push(request.url);
    if (requests.length > 1) return RuntimeResponse.json({keys: [jwk]});
    return new RuntimeResponse(null, {status: 302, headers: {location: 'https://untrusted.test/keys'}});
  });
  try {
    const response = await mf.dispatchFetch('https://hao.test/', {headers: {'cf-access-jwt-assertion': assertion}});
    const result = await response.json();
    assert.equal(response.status, 401);
    assert.equal(result.user, null);
    assert.equal(result.diagnostics.code, 'ACCESS_KEYS_UNAVAILABLE');
    assert.deepEqual(requests, ['https://' + settings.ACCESS_TEAM_DOMAIN + '/cdn-cgi/access/certs']);
  } finally {
    await mf.dispose();
  }
});
