import test from 'node:test'; import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/server/auth/password';
import { signSession, verifySession, sessionSecret, sessionVersion, parseCookies } from '../src/server/auth/session';
import { createLimiter } from '../src/server/auth/ratelimit';
import { assertSameOrigin, HttpError } from '../src/server/http';

const SECRET = 'x'.repeat(40);
test('password hash verifies, wrong password fails, never plaintext', async () => {
  const h = await hashPassword('correct horse');
  assert.ok(h.startsWith('scrypt$') && !h.includes('correct horse'));
  assert.equal(await verifyPassword('correct horse', h), true);
  assert.equal(await verifyPassword('wrong', h), false);
  assert.equal(await verifyPassword('x', null), false);
  assert.equal(await verifyPassword('x', 'garbage'), false);
});
test('session: roundtrip, tamper, expiry, wrong secret', () => {
  const now = 1_000_000_000_000, exp = now / 1000 + 100;
  const t = signSession({ uid: 'u1', sv: 'abc', exp }, SECRET);
  assert.equal(verifySession(t, SECRET, now)?.uid, 'u1');
  assert.equal(verifySession(t, 'y'.repeat(40), now), null);
  assert.equal(verifySession(t, SECRET, now + 200_000), null);
  const [p, s] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ uid: 'admin', sv: 'abc', exp })).toString('base64url');
  assert.equal(verifySession(`${forged}.${s}`, SECRET, now), null);
  assert.equal(verifySession(`${p}.${s}.x`, SECRET, now), null);
  assert.equal(verifySession(undefined, SECRET, now), null);
});
test('session secret must be strong; password change alters version', () => {
  assert.throws(() => sessionSecret({ SESSION_SECRET: 'change-me' }));
  assert.throws(() => sessionSecret({}));
  assert.equal(sessionSecret({ SESSION_SECRET: SECRET }), SECRET);
  assert.notEqual(sessionVersion('a'), sessionVersion('b'));
  assert.notEqual(sessionVersion('a', 0), sessionVersion('a', 1));
  assert.deepEqual(parseCookies('a=1; dx_session=tok.sig'), { a: '1', dx_session: 'tok.sig' });
});
test('rate limiter blocks after max within window and resets', () => {
  const l = createLimiter({ windowMs: 1000, max: 2 });
  assert.ok(l.check('k', 0).ok); assert.ok(l.check('k', 1).ok);
  const r = l.check('k', 2); assert.equal(r.ok, false); assert.ok(r.retryAfterS >= 1);
  assert.ok(l.check('k', 1500).ok);
});
test('same-origin guard', () => {
  const mk = (origin?: string) => new Request('http://shop.test/api', { method: 'POST', headers: { host: 'shop.test', ...(origin ? { origin } : {}) } });
  assertSameOrigin(mk('http://shop.test')); assertSameOrigin(mk());
  assert.throws(() => assertSameOrigin(mk('http://evil.test')), (e) => e instanceof HttpError && e.status === 403);
});
