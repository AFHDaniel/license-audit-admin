import { createHash } from 'node:crypto';

const USERINFO_CACHE_MS = 60_000;
const userinfoCache = new Map();

function cacheKey(token) {
  // Hash the bearer so the raw token never persists in memory as a Map key.
  return createHash('sha256').update(token).digest('hex');
}

function bearerFromHeader(header) {
  if (typeof header !== 'string') return '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice(7).trim();
}

function userinfoUrl() {
  const issuer = (process.env.OKTA_ISSUER || process.env.VITE_OKTA_ISSUER || '').replace(/\/+$/, '');
  if (!issuer) return '';
  // Okta org-as-authorization-server uses /oauth2/v1/userinfo; custom auth servers
  // (default or named) expose the same path under /oauth2/{authServer}/v1/userinfo.
  if (/\/oauth2\/[^/]+$/.test(issuer)) {
    return `${issuer}/v1/userinfo`;
  }
  return `${issuer}/oauth2/v1/userinfo`;
}

export async function fetchOktaUserinfo(accessToken, { fetchImpl = fetch } = {}) {
  if (!accessToken) return null;
  const key = cacheKey(accessToken);
  const cached = userinfoCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const url = userinfoUrl();
  if (!url) throw new Error('OKTA_ISSUER is not configured on the server.');

  const res = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401 || res.status === 403) {
    userinfoCache.set(key, { value: null, expiresAt: Date.now() + 5_000 });
    return null;
  }
  if (!res.ok) {
    const text = typeof res.text === 'function' ? await res.text() : '';
    throw new Error(`Okta userinfo failed (${res.status}): ${text || 'unknown error'}`);
  }

  const value = await res.json();
  userinfoCache.set(key, { value, expiresAt: Date.now() + USERINFO_CACHE_MS });
  return value;
}

export function extractEmailFromUserinfo(userinfo) {
  if (!userinfo || typeof userinfo !== 'object') return '';
  const candidates = [
    userinfo.email,
    userinfo.preferred_username,
    userinfo.login,
    userinfo.upn,
    userinfo.unique_name,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.includes('@')) {
      return candidate.trim().toLowerCase();
    }
  }
  return '';
}

const SUPER_ADMIN_EMAIL = 'daniel@atlantafinehomes.com';

export function getSuperAdminEmail() {
  return (process.env.SUPER_ADMIN_EMAIL || SUPER_ADMIN_EMAIL).trim().toLowerCase();
}

export async function verifySuperAdmin(req, { fetchImpl } = {}) {
  const token = bearerFromHeader(req.headers?.authorization || '');
  if (!token) return { ok: false, status: 401, error: 'Missing bearer token.' };

  let userinfo;
  try {
    userinfo = await fetchOktaUserinfo(token, fetchImpl ? { fetchImpl } : undefined);
  } catch (error) {
    return { ok: false, status: 502, error: error?.message || 'Okta verification failed.' };
  }
  if (!userinfo) return { ok: false, status: 401, error: 'Invalid or expired access token.' };

  const email = extractEmailFromUserinfo(userinfo);
  if (!email) return { ok: false, status: 401, error: 'No usable email claim on token.' };

  const expected = getSuperAdminEmail();
  if (email !== expected) return { ok: false, status: 403, error: 'Not authorized.' };

  return { ok: true, email, userinfo };
}

const DEFAULT_ALLOWED_DOMAIN = 'atlantafinehomes.com';

export function getAllowedOktaDomains() {
  const raw = (process.env.ALLOWED_OKTA_DOMAINS || DEFAULT_ALLOWED_DOMAIN)
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return raw.length ? raw : [DEFAULT_ALLOWED_DOMAIN];
}

/**
 * Verify a request has a valid Okta access token from any user in the allowed
 * domain list. Used to gate read endpoints that previously had no server-side
 * auth (e.g. /api/licenses). Returns the resolved email on success.
 */
export async function verifyOktaUser(req, { fetchImpl } = {}) {
  const token = bearerFromHeader(req.headers?.authorization || '');
  if (!token) return { ok: false, status: 401, error: 'Missing bearer token.' };

  let userinfo;
  try {
    userinfo = await fetchOktaUserinfo(token, fetchImpl ? { fetchImpl } : undefined);
  } catch (error) {
    return { ok: false, status: 502, error: error?.message || 'Okta verification failed.' };
  }
  if (!userinfo) return { ok: false, status: 401, error: 'Invalid or expired access token.' };

  const email = extractEmailFromUserinfo(userinfo);
  if (!email) return { ok: false, status: 401, error: 'No usable email claim on token.' };

  const domain = email.split('@')[1] || '';
  const allowed = getAllowedOktaDomains();
  if (!allowed.includes(domain)) {
    return { ok: false, status: 403, error: 'Not authorized for this domain.' };
  }

  return { ok: true, email, userinfo };
}

export function clearOktaUserinfoCacheForTest() {
  userinfoCache.clear();
}
