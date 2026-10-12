import { createLimiter } from './auth/ratelimit';
import { HttpError } from './http';
export const loginLimiter = createLimiter({ windowMs: 15 * 60_000, max: 10 });
export const registerLimiter = createLimiter({ windowMs: 60 * 60_000, max: 5 });
export const orderLimiter = createLimiter({ windowMs: 10 * 60_000, max: 20 });
export function enforce(l: { check(k: string): { ok: boolean; retryAfterS: number } }, key: string) {
  const r = l.check(key); if (!r.ok) throw new HttpError(429, 'rate_limited', 'محاولات كثيرة، حاول لاحقًا.', r.retryAfterS);
}
