import { Problem } from './model.mjs';

const encoder = new TextEncoder();
const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const read = value => JSON.parse(new TextDecoder().decode(decode(value)));
let keysCache;

export async function digest(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))),
    byte => byte.toString(16).padStart(2, '0')).join('');
}

export function newCode() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18)))).replace(/\+/g, '-').replace(/\//g, '_');
}

async function keys(issuer) {
  if (keysCache?.issuer === issuer && keysCache.expires > Date.now()) return keysCache.keys;
  const response = await fetch(issuer + '/cdn-cgi/access/certs', { redirect: 'error' });
  if (!response.ok) throw Error('Access certificate service failed.');
  const { keys } = await response.json();
  keysCache = { issuer, keys, expires: Date.now() + 300_000 };
  return keys;
}

export async function administrator(request, env, access) {
  const host = new URL(request.url).hostname;
  if (env.LOCAL_DEV === '1' && ['127.0.0.1', 'localhost'].includes(host)) return 'local-developer';
  const audience = env.ACCESS_AUD;
  if (audience && access?.aud === audience) {
    try {
      const identity = await access.getIdentity();
      if (typeof identity?.email === 'string' && identity.email) return identity.email;
      console.warn('Factory Access authentication: verified identity has no email');
    } catch {
      console.warn('Factory Access authentication: runtime identity unavailable');
    }
  }
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  const issuer = env.ACCESS_ISSUER;
  if (!token || token.length > 8192 || !audience || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer ?? '')) {
    throw new Problem(403, 'Sign in through Cloudflare Access to open the team dashboard.');
  }
  let check = 'token format';
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw Error();
    const [header, payload, signature] = parts;
    const { alg, kid } = read(header);
    const claims = read(payload);
    const now = Math.floor(Date.now() / 1000);
    check = 'issuer or audience';
    if (alg !== 'RS256' || claims.iss !== issuer || !Array.isArray(claims.aud) || !claims.aud.includes(audience)) throw Error();
    check = 'expiration or identity';
    if (!Number.isFinite(claims.exp) || claims.exp <= now || (claims.nbf !== undefined && claims.nbf > now) ||
        typeof claims.email !== 'string' || !claims.email) throw Error();
    check = 'signing key';
    const jwk = (await keys(issuer)).find(key => key.kid === kid);
    if (!jwk) throw Error();
    const key = await crypto.subtle.importKey('jwk', jwk, { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' }, false, ['verify']);
    check = 'signature';
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(signature), encoder.encode(header + '.' + payload))) throw Error();
    return claims.email;
  } catch {
    console.warn('Factory Access authentication failed:', check);
    throw new Problem(403, 'Team sign-in could not be verified.');
  }
}

export function requireSameOrigin(request) {
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    throw new Problem(403, 'Open the form directly and try again.');
  }
}

export async function boundedForm(request, limit = 32_000) {
  const size = Number(request.headers.get('Content-Length'));
  if (size > limit) throw new Problem(413, 'The form is too large.');
  const reader = request.body?.getReader();
  const chunks = [];
  let length = 0;
  if (!reader) throw new Problem(400, 'The form is empty.');
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) {
      await reader.cancel();
      throw new Problem(413, 'The form is too large.');
    }
    chunks.push(value);
  }
  try {
    return await new Response(new Blob(chunks), { headers: { 'Content-Type': request.headers.get('Content-Type') || '' } }).formData();
  } catch {
    throw new Problem(400, 'The form could not be read.');
  }
}
