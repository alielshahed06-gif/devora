import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'dx_session';
export const SESSION_TTL_S = 60 * 60 * 24 * 7;
export interface SessionClaims { uid: string; exp: number; sv: string } // exp = unix seconds; sv = password-version fingerprint
const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url');

export function sessionSecret(env: Record<string, string | undefined> = process.env): string {
  const s = env.SESSION_SECRET;
  if (!s || s.length < 32 || s === 'change-me') throw new Error('SESSION_SECRET must be set to >= 32 random characters');
  return s;
}
/** Changing the password changes this fingerprint, which invalidates all older sessions. Role is NOT stored in the token: it is re-read from the DB. */
export const sessionVersion = (passwordHash: string | null | undefined, generation = 0) =>
  createHash('sha256').update(`${passwordHash ?? ''}:${generation}`).digest('hex').slice(0, 12);

const mac = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest();

export function signSession(c: SessionClaims, secret: string): string {
  const payload = b64(JSON.stringify(c));
  return `${payload}.${b64(mac(payload, secret))}`;
}
export function verifySession(token: string | undefined | null, secret: string, nowMs = Date.now()): SessionClaims | null {
  if (!token) return null;
  const [payload, sig, extra] = token.split('.');
  if (!payload || !sig || extra !== undefined) return null;
  const want = mac(payload, secret), got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const c = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionClaims;
    if (typeof c.uid !== 'string' || typeof c.sv !== 'string' || typeof c.exp !== 'number' || c.exp * 1000 <= nowMs) return null;
    return c;
  } catch { return null; }
}
export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) { const i = part.indexOf('='); if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }
  return out;
}
export const sessionCookie = (token: string, secure = process.env.NODE_ENV === 'production') =>
  `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_S}${secure ? '; Secure' : ''}`;
export const clearSessionCookie = (secure = process.env.NODE_ENV === 'production') =>
  `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
