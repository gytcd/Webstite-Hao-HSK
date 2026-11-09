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

test('production Worker verifies identity, uses native D1 and calls Gemini through its protected API', async () => {
  const paths=['worker/standalone.mjs','lib/access-auth.mjs','lib/standalone-store.mjs','lib/study-service.mjs','lib/ai-service.mjs','lib/reminders.mjs','public/study-model.js'];
  const modules=await Promise.all(paths.map(async path=>({type:'ESModule',path,contents:await readFile(new URL('../'+path,import.meta.url),'utf8')})));
  const config=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  const feedback={reply:'你好！',pinyin:'Nǐ hǎo!',translation:'Xin chào!',corrected:'你好！',explanation:'Lời chào thông dụng.',issues:[],score:0,scoreNote:''};
  let modelCalls=0,metadataCalls=0,assets=0,providerError=false;
  const mf=new Miniflare({
    compatibilityDate:config.compatibility_date,
    modules:[{type:'ESModule',path:'main.mjs',contents:"export {default} from './worker/standalone.mjs';"},...modules],
    bindings:{...settings,GEMINI_API_KEY:'runtime-test-key'},
    d1Databases:{DB:'learning-test-database'},
    serviceBindings:{ASSETS:()=>{assets++;return new RuntimeResponse('private asset');}},
    outboundService:request=>{
      if(request.url==='https://'+settings.ACCESS_TEAM_DOMAIN+'/cdn-cgi/access/certs')return RuntimeResponse.json({keys:[jwk]});
      if(request.url==='https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash'){
        metadataCalls++;assert.equal(request.headers.get('x-goog-api-key'),'runtime-test-key');
        return providerError ? RuntimeResponse.json({error:{code:403,status:'PERMISSION_DENIED',message:'private runtime-test-key',details:[{reason:'API_KEY_HTTP_REFERRER_BLOCKED'}]}},{status:403}) : RuntimeResponse.json({name:'models/gemini-3.8-flash'});
      }
      assert.equal(request.url,'https://generativelanguage.googleapis.com/v1beta/interactions');
      assert.equal(request.headers.get('x-goog-api-key'),'runtime-test-key');modelCalls++;
      return RuntimeResponse.json({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(feedback)}]}]});
    }
  });
  try {
    assert.equal((await mf.dispatchFetch('https://hao.test/')).status,401);assert.equal(assets,0);
    const headers={'cf-access-jwt-assertion':assertion};
    const identity=await mf.dispatchFetch('https://hao.test/api/me',{headers});assert.equal(identity.status,200);
    const response=await mf.dispatchFetch('https://hao.test/api/ai',{method:'POST',headers:{...headers,origin:'https://hao.test','content-type':'application/json','x-hao-ai':'1'},body:JSON.stringify({mode:'grammar',text:'你好'})});
    const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.result.reply,feedback.reply);assert.equal(modelCalls,1);
    const configResult=await(await mf.dispatchFetch('https://hao.test/api/ai',{headers})).json();assert.equal(configResult.used,1);assert.equal(JSON.stringify(configResult).includes('runtime-test-key'),false);
    const checkHeaders={...headers,'x-hao-ai':'1'};
    const checked=await(await mf.dispatchFetch('https://hao.test/api/ai?check=1',{headers:checkHeaders})).json();assert.equal(checked.keyVerified,true);assert.equal(checked.used,1);assert.equal(metadataCalls,1);assert.equal(modelCalls,1);
    providerError=true;
    const rejected=await mf.dispatchFetch('https://hao.test/api/ai?check=1',{headers:checkHeaders});const diagnosis=await rejected.json();assert.equal(rejected.status,502);assert.equal(diagnosis.code,'AI_KEY_RESTRICTED');assert.equal(diagnosis.providerStatus,403);assert.equal(JSON.stringify(diagnosis).includes('runtime-test-key'),false);
    const review={id:'runtime-review',card:'hsk-1:你',courseId:'hsk-1',word:'你',grade:3,at:Date.now()};
    const record={key:'lab:review:runtime-review',value:review,stamp:Date.now(),actor:'runtime_device',deleted:false};
    const saved=await mf.dispatchFetch('https://hao.test/api/sync?v=2',{method:'POST',headers:{...headers,origin:'https://hao.test','content-type':'application/json'},body:JSON.stringify({records:[record]})});assert.equal(saved.status,200);assert.equal((await saved.json()).records.length,1);
    const legacy=await(await mf.dispatchFetch('https://hao.test/api/sync',{headers})).json();assert.equal(legacy.records.length,0);
  } finally {await mf.dispose();}
});
