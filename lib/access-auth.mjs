// Verify the signed Access assertion. Static Assets' internal router does not
// propagate ctx.access. Either token transport must pass the same checks.
const utf8 = new TextEncoder();
const decode = value => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid base64url');
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
};
const fromJSON = value => JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(decode(value)));

export function accessSettings(env) {
  const host = String(env.ACCESS_TEAM_DOMAIN || '').trim().replace(/^https:\/\//, '').replace(/\/$/, '').toLowerCase();
  const audience = String(env.ACCESS_AUD || '').trim();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(host) || !audience || audience.length > 256) return null;
  return {issuer: 'https://' + host, audience};
}

export function createAccessVerifier() {
  const cache = new Map();
  return async function verify(request, env, {fetcher = fetch, now = Date.now(), diagnostics} = {}) {
    const fail = code => {
      if (diagnostics) diagnostics.code = code;
      return null;
    };
    const settings = accessSettings(env);
    if (!settings) return fail('ACCESS_CONFIGURATION_MISSING');
    let assertion = request.headers.get('cf-access-jwt-assertion');
    if (assertion === null) {
      const cookies = (request.headers.get('cookie') || '').split(';').map(value => value.trim()).filter(value => value.startsWith('CF_Authorization='));
      // Reject ambiguous cookies and never replace an invalid assertion header.
      if (cookies.length > 1) return fail('ACCESS_COOKIE_AMBIGUOUS');
      assertion = cookies.length === 1 ? cookies[0].slice('CF_Authorization='.length) : null;
    }
    if (!assertion) return fail('ACCESS_TOKEN_MISSING');
    if (assertion.length > 16384) return fail('ACCESS_TOKEN_TOO_LARGE');
    let stage = 'ACCESS_TOKEN_INVALID';
    try {
      const parts = assertion.split('.');
      if (parts.length !== 3) return fail(stage);
      const header = fromJSON(parts[0]), claims = fromJSON(parts[1]);
      const seconds = now / 1000;
      if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length > 200 || header.crit || header.b64 === false) return fail('ACCESS_TOKEN_ALGORITHM');
      if (claims.iss !== settings.issuer) return fail('ACCESS_ISSUER_MISMATCH');
      if (!Array.isArray(claims.aud) || !claims.aud.includes(settings.audience)) return fail('ACCESS_AUDIENCE_MISMATCH');
      if (!Number.isFinite(claims.exp) || claims.exp <= seconds) return fail('ACCESS_SESSION_EXPIRED');
      if ((claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > seconds + 30)) || (claims.iat !== undefined && (!Number.isFinite(claims.iat) || claims.iat > seconds + 30))) return fail('ACCESS_SESSION_NOT_YET_VALID');
      if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 256 || typeof claims.email !== 'string' || claims.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email)) return fail('ACCESS_IDENTITY_MISSING');

      stage = 'ACCESS_KEYS_UNAVAILABLE';
      let entry = cache.get(settings.issuer);
      const unknownKey = entry && !entry.keys.some(k => k.kid === header.kid);
      if (!entry || entry.expires <= now || (unknownKey && entry.fetched + 30000 <= now)) {
        // Workers does not implement redirect: 'error'. Manual mode plus the
        // status check below rejects redirects without following another host.
        const response = await fetcher(settings.issuer + '/cdn-cgi/access/certs', {redirect: 'manual', signal: AbortSignal.timeout(8000)});
        if (!response.ok) return fail(stage);
        const raw = await response.text();
        if (raw.length > 100000) return fail(stage);
        const data = JSON.parse(raw);
        if (!Array.isArray(data.keys) || data.keys.length > 20) return fail(stage);
        entry = {keys: data.keys, imported: new Map(), fetched: now, expires: now + 3600000};
        if (cache.size >= 2 && !cache.has(settings.issuer)) cache.delete(cache.keys().next().value);
        cache.set(settings.issuer, entry);
      }
      stage = 'ACCESS_SIGNING_KEY_INVALID';
      const jwk = entry.keys.find(k => k.kid === header.kid && k.kty === 'RSA' && (!k.alg || k.alg === 'RS256') && (!k.use || k.use === 'sig'));
      if (!jwk || !jwk.n || decode(jwk.n).length < 256) return fail(stage);
      let key = entry.imported.get(header.kid);
      if (!key) {
        key = await crypto.subtle.importKey('jwk', jwk, {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['verify']);
        entry.imported.set(header.kid, key);
      }
      stage = 'ACCESS_SIGNATURE_INVALID';
      if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(parts[2]), utf8.encode(parts[0] + '.' + parts[1]))) return fail(stage);
      const digest = await crypto.subtle.digest('SHA-256', utf8.encode(settings.issuer + '\0' + claims.sub));
      const userId = 'access_' + [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
      const fullName = typeof claims.name === 'string' ? claims.name.slice(0, 100) : null;
      return {userId, email: claims.email, displayName: fullName || claims.email.split('@')[0], fullName};
    } catch {
      return fail(stage);
    }
  };
}
