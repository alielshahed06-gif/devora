import { randomBytes, scrypt as _scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const N = 16384, R = 8, P = 1, KEYLEN = 64;
const scrypt = (pw: string, salt: Buffer, len: number, opts: ScryptOptions) =>
  new Promise<Buffer>((res, rej) => _scrypt(pw, salt, len, opts, (e, k) => (e ? rej(e) : res(k))));

/** Format: scrypt$N$r$p$<salt b64>$<hash b64>. Node built-in scrypt: no extra dependency. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const parts = (stored ?? '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') { await scrypt(password, Buffer.alloc(16), KEYLEN, { N, r: R, p: P }); return false; } // equalise timing for unknown users
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, 'base64');
  const key = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}
