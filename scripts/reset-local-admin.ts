import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/server/auth/password';

const databaseUrl = process.env.DATABASE_URL;
const email = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? '').trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? '';
if (process.env.NODE_ENV === 'production' || !databaseUrl) throw new Error('Local administrator reset is disabled in production.');
const target = new URL(databaseUrl);
if (!['localhost', '127.0.0.1', '::1'].includes(target.hostname) || target.port !== '55433' || target.pathname !== '/devx_store_dev') {
  throw new Error('Refusing to reset an administrator outside the isolated project-owned development database.');
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6 || password.length > 128) {
  throw new Error('The local administrator email or temporary password is invalid.');
}

const prisma = new PrismaClient();
async function main() {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (!existing || existing.role !== 'ADMIN') throw new Error('The configured local administrator was not found; no account was changed.');
  await prisma.user.update({
    where: { id: existing.id },
    data: { passwordHash: await hashPassword(password), mustChangePassword: true, sessionGeneration: { increment: 1 } },
    select: { id: true },
  });
  console.log('Local administrator password reset; the next sign-in must replace it before using administration.');
}

main().catch(() => {
  console.error('Local administrator reset failed; check the isolated local database, schema, and bootstrap email.');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
