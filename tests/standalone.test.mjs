import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {createAccessVerifier, accessSettings} from '../lib/access-auth.mjs';
import {schema, initialize} from '../lib/standalone-store.mjs';
import worker from '../worker/standalone.mjs';
import {CloudSync} from '../public/cloud-sync.js';

const settings = {ACCESS_TEAM_DOMAIN: 'hsk-tests.cloudflareaccess.com', ACCESS_AUD: 'a'.repeat(64)};
const now = Date.now();
const baseClaims = {iss: 'https://' + settings.ACCESS_TEAM_DOMAIN, aud: [settings.ACCESS_AUD], sub: 'user-a', email: 'a@example.com', iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 3600};
const b64 = value => Buffer.from(value).toString('base64url');
let pair, jwk, pair2, jwk2, originalFetch;
before(async () => {
  const algorithm = {name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: 'SHA-256'};
  pair = await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify']);
  pair2 = await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify']);
  jwk = {...await crypto.subtle.exportKey('jwk', pair.publicKey), kid: 'key-one', alg: 'RS256', use: 'sig'};
  jwk2 = {...await crypto.subtle.exportKey('jwk', pair2.publicKey), kid: 'key-two', alg: 'RS256', use: 'sig'};
  originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.equal(url, 'https://' + settings.ACCESS_TEAM_DOMAIN + '/cdn-cgi/access/certs');
    return Response.json({keys: [jwk]});
  };
});
after(() => {globalThis.fetch = originalFetch;});
async function token(claims = {}, header = {}, key = pair.privateKey) {
  const h = b64(JSON.stringify({alg: 'RS256', kid: 'key-one', ...header}));
  const p = b64(JSON.stringify({...baseClaims, ...claims}));
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(h + '.' + p));
  return h + '.' + p + '.' + b64(signature);
}
function database() {
  const sql = new DatabaseSync(':memory:');
  function prepare(query, args = []) {
    return {
      bind(...values) {return prepare(query, values);},
      async run() {const r = sql.prepare(query).run(...args); return {success: true, meta: {changes: Number(r.changes)}, results: []};},
      async all() {return {results: sql.prepare(query).all(...args)};},
      async first() {return sql.prepare(query).get(...args) || null;}
    };
  }
  return {sql, prepare, async batch(statements) {
    sql.exec('BEGIN');
    try {const results = []; for (const s of statements) results.push(await s.run()); sql.exec('COMMIT'); return results;}
    catch (e) {sql.exec('ROLLBACK'); throw e;}
  }};
}
async function request(path, {claims, headers, method = 'GET', body} = {}) {
  return new Request('https://hao.test' + path, {method, headers: {'cf-access-jwt-assertion': await token(claims), ...headers}, ...(body === undefined ? {} : {body})});
}
const envFor = db => ({...settings, DB: db, ASSETS: {fetch: async () => new Response('<h1>HSK</h1>', {headers: {'content-type': 'text/html'}})}});

test('missing Access configuration and spoofed identity headers cannot expose assets or accounts', async () => {
  let served = false;
  const assets = {fetch: async () => {served = true; return new Response('private');}};
  assert.equal((await worker.fetch(new Request('https://hao.test/'), {ASSETS: assets})).status, 503);
  const forged = new Request('https://hao.test/api/me', {headers: {'oai-authenticated-user-id': 'victim', 'oai-authenticated-user-email': 'victim@example.com', 'cf-access-authenticated-user-email': 'victim@example.com'}});
  assert.equal((await worker.fetch(forged, {...settings, ASSETS: assets})).status, 401);
  assert.equal((await worker.fetch(new Request('https://hao.test/style.css'), {...settings, ASSETS: assets})).status, 401);
  assert.equal(served, false);
  assert.equal(accessSettings({ACCESS_TEAM_DOMAIN: 'evil.test/path', ACCESS_AUD: 'x'}), null);
});

test('Access JWT validation checks signature, algorithm, issuer, audience and validity times', async () => {
  const verify = createAccessVerifier();
  const check = async (claims, header = {}, key) => verify(new Request('https://hao.test', {headers: {'cf-access-jwt-assertion': await token(claims, header, key)}}), settings, {now});
  assert.equal((await check({})).email, 'a@example.com');
  for (const claims of [{aud: ['other']}, {iss: 'https://other.cloudflareaccess.com'}, {exp: Math.floor(now / 1000)}, {nbf: Math.floor(now / 1000) + 600}, {iat: Math.floor(now / 1000) + 600}, {email: ''}, {sub: ''}]) assert.equal(await check(claims), null);
  assert.equal(await check({}, {alg: 'none'}), null);
  assert.equal(await check({}, {alg: 'HS256'}), null);
  assert.equal(await check({}, {crit: ['unknown']}), null);
  assert.equal(await check({}, {}, pair2.privateKey), null);
  const valid = await token();
  const parts = valid.split('.'); parts[1] = b64(JSON.stringify({...baseClaims, email: 'victim@example.com'}));
  assert.equal(await verify(new Request('https://hao.test', {headers: {'cf-access-jwt-assertion': parts.join('.')}}), settings), null);
});

test('signing key rotation refreshes certificates and account ID remains stable for one subject', async () => {
  const verify = createAccessVerifier();
  const one = new Request('https://hao.test', {headers: {'cf-access-jwt-assertion': await token()}});
  const a = await verify(one, settings, {now, fetcher: async () => Response.json({keys: [jwk]})});
  const rotated = new Request('https://hao.test', {headers: {'cf-access-jwt-assertion': await token({email: 'new@example.com'}, {kid: 'key-two'}, pair2.privateKey)}});
  const b = await verify(rotated, settings, {now: now + 31000, fetcher: async () => Response.json({keys: [jwk2]})});
  assert.equal(a.userId, b.userId);
  assert.equal(b.email, 'new@example.com');
  const other = new Request('https://hao.test', {headers: {'cf-access-jwt-assertion': await token({sub: 'user-b'}, {kid: 'key-two'}, pair2.privateKey)}});
  assert.notEqual((await verify(other, settings, {now: now + 31000})).userId, a.userId);
  const offline = createAccessVerifier();
  assert.equal(await offline(one, settings, {fetcher: async () => {throw new Error('unreachable');}}), null);
});

test('D1 initialization preserves existing records, and accounts and sync data remain isolated', async () => {
  const db = database(), env = envFor(db);
  db.sql.exec(schema[0]);
  db.sql.prepare('INSERT INTO study_records VALUES(?,?,?,?,?,?,?)').run('old-site-user', 'note:legacy', '"keep"', 1, 'old_device', 0, 1);
  await initialize(db);
  assert.equal(db.sql.prepare('SELECT value FROM study_records WHERE user_id=?').get('old-site-user').value, '"keep"');
  const a = await (await worker.fetch(await request('/api/me'), env)).json();
  const b = await (await worker.fetch(await request('/api/me', {claims: {sub: 'user-b', email: 'b@example.com'}}), env)).json();
  assert.notEqual(a.user.id, b.user.id);
  assert.equal(a.capabilities.pdfSync, false);
  assert.equal(a.capabilities.avatarSync, true);
  assert.equal(a.cloudReady, true);
  assert.equal(db.sql.prepare('SELECT count(*) AS n FROM hao_accounts').get().n, 2);
  const record = {key: 'note:one', value: 'private', actor: 'device_12345678', stamp: 100, deleted: false};
  const post = await request('/api/sync', {method: 'POST', headers: {'content-type': 'application/json', origin: 'https://hao.test'}, body: JSON.stringify({records: [record], userId: b.user.id})});
  assert.equal((await worker.fetch(post, env)).status, 200);
  const rowsB = await (await worker.fetch(await request('/api/sync', {claims: {sub: 'user-b', email: 'b@example.com'}}), env)).json();
  assert.equal(rowsB.records.length, 0);
  const rowsA = await (await worker.fetch(await request('/api/sync'), env)).json();
  assert.equal(rowsA.records[0].value, 'private');
  const crossOrigin = await request('/api/sync', {method: 'POST', headers: {'content-type': 'application/json', origin: 'https://evil.test'}, body: JSON.stringify({records: []})});
  assert.equal((await worker.fetch(crossOrigin, env)).status, 403);
});

test('avatars use D1 without R2 and enforce image bytes, hash, origin, size and ownership', async () => {
  const db = database(), env = envFor(db);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
  const hash = Buffer.from(await crypto.subtle.digest('SHA-256', png)).toString('hex');
  const put = (body = png, headers = {}) => request('/api/avatar/' + hash, {method: 'PUT', body, headers: {'content-type': 'image/png', 'x-hao-upload': '1', origin: 'https://hao.test', ...headers}});
  assert.equal((await worker.fetch(await put(), env)).status, 200);
  assert.deepEqual(Buffer.from(await (await worker.fetch(await request('/api/avatar/' + hash), env)).arrayBuffer()), png);
  assert.equal((await worker.fetch(await request('/api/avatar/' + hash, {claims: {sub: 'user-b', email: 'b@example.com'}}), env)).status, 404);
  assert.equal((await worker.fetch(await put(png, {origin: 'https://evil.test'}), env)).status, 403);
  assert.equal((await worker.fetch(await put(Buffer.from('not an image')), env)).status, 400);
  assert.equal((await worker.fetch(await put(new Uint8Array(512 * 1024 + 1)), env)).status, 413);
  const wrongHash = await request('/api/avatar/' + '0'.repeat(64), {method: 'PUT', body: png, headers: {'content-type': 'image/png', 'x-hao-upload': '1'}});
  assert.equal((await worker.fetch(wrongHash, env)).status, 400);
  assert.equal((await worker.fetch(await request('/api/files/' + hash), env)).status, 410);
});

test('authenticated assets use the asset binding and sign-out reaches Cloudflare Access logout', async () => {
  const env = envFor(database());
  const page = await worker.fetch(await request('/'), env);
  assert.equal(page.status, 200);
  assert.equal(await page.text(), '<h1>HSK</h1>');
  assert.match(page.headers.get('cache-control'), /private/);
  const logout = await worker.fetch(await request('/logout'), env);
  assert.equal(logout.headers.get('location'), 'https://hao.test/cdn-cgi/access/logout');
});

test('client skips PDF upload while retaining local PDF data in D1-only mode', async () => {
  const pdf = {id: 'local-pdf', name: 'private.pdf', blob: new Blob(['%PDF-local'], {type: 'application/pdf'})};
  const db = {transaction() {return {objectStore() {return {getAll() {const req = {}; queueMicrotask(() => {req.result = [pdf]; req.onsuccess();}); return req;}};}};}};
  const sync = new CloudSync({db, userId: 'local', fileSync: false});
  sync.dirtyFiles.add(pdf.id);
  sync.request = () => {throw new Error('No PDF request should be sent');};
  assert.deepEqual(await sync.uploadFiles(), []);
  assert.equal(sync.pending.size, 0);
  assert.equal(await pdf.blob.text(), '%PDF-local');
});

test('deployment configuration uses the real D1, protects static assets, and restores the HSK shell', async () => {
  const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
  assert.equal(config.name, 'haohsk');
  assert.equal(config.d1_databases[0].database_id, 'a83768bc-63e2-46f6-bb9f-c34313308144');
  assert.equal(config.assets.run_worker_first, true);
  assert.equal(config.r2_buckets, undefined);
  assert.equal(config.keep_vars, true);
  const built = await readFile('dist/client/index.html', 'utf8');
  assert.equal(built, await readFile('ui-shell.html', 'utf8'));
  assert.match(built, /id="view"/);
});
