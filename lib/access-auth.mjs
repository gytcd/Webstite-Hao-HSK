// Verify the signed Access assertion. Static Assets' internal router does not
// propagate ctx.access, so a header value alone must never establish identity.
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
  return async function verify(request, env, {fetcher = fetch, now = Date.now()} = {}) {
    const settings = accessSettings(env);
    if (!settings) return null;
    const assertion = request.headers.get('cf-access-jwt-assertion');
    if (!assertion || assertion.length > 16384) return null;
    try {
      const parts = assertion.split('.');
      if (parts.length !== 3) return null;
      const header = fromJSON(parts[0]), claims = fromJSON(parts[1]);
      const seconds = now / 1000;
      if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length > 200 || header.crit || header.b64 === false) return null;
      if (claims.iss !== settings.issuer || !Array.isArray(claims.aud) || !claims.aud.includes(settings.audience)) return null;
      if (!Number.isFinite(claims.exp) || claims.exp <= seconds || (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > seconds + 30))) return null;
      if (claims.iat !== undefined && (!Number.isFinite(claims.iat) || claims.iat > seconds + 30)) return null;
      if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 256 || typeof claims.email !== 'string' || claims.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email)) return null;

      let entry = cache.get(settings.issuer);
      const unknownKey = entry && !entry.keys.some(k => k.kid === header.kid);
      if (!entry || entry.expires <= now || (unknownKey && entry.fetched + 30000 <= now)) {
        const response = await fetcher(settings.issuer + '/cdn-cgi/access/certs', {redirect: 'error', signal: AbortSignal.timeout(8000)});
        if (!response.ok) return null;
        const raw = await response.text();
        if (raw.length > 100000) return null;
        const data = JSON.parse(raw);
        if (!Array.isArray(data.keys) || data.keys.length > 20) return null;
        entry = {keys: data.keys, imported: new Map(), fetched: now, expires: now + 3600000};
        if (cache.size >= 2 && !cache.has(settings.issuer)) cache.delete(cache.keys().next().value);
        cache.set(settings.issuer, entry);
      }
      const jwk = entry.keys.find(k => k.kid === header.kid && k.kty === 'RSA' && (!k.alg || k.alg === 'RS256') && (!k.use || k.use === 'sig'));
      if (!jwk || !jwk.n || decode(jwk.n).length < 256) return null;
      let key = entry.imported.get(header.kid);
      if (!key) {
        key = await crypto.subtle.importKey('jwk', jwk, {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['verify']);
        entry.imported.set(header.kid, key);
      }
      if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(parts[2]), utf8.encode(parts[0] + '.' + parts[1]))) return null;
      const digest = await crypto.subtle.digest('SHA-256', utf8.encode(settings.issuer + '\0' + claims.sub));
      const userId = 'access_' + [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
      const fullName = typeof claims.name === 'string' ? claims.name.slice(0, 100) : null;
      return {userId, email: claims.email, displayName: fullName || claims.email.split('@')[0], fullName};
    } catch {
      return null;
    }
  };
}
