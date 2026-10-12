import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/server/auth/password';

const databaseUrl = process.env.DATABASE_URL;
const email = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? '').trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? '';
if (process.env.NODE_ENV === 'production' || !databaseUrl) throw new Error('Local administrator bootstrap is disabled in production.');
const target = new URL(databaseUrl);
if (!['localhost', '127.0.0.1', '::1'].includes(target.hostname) || target.pathname !== '/devx_store_dev') {
  throw new Error('Refusing to bootstrap an administrator outside the isolated local devx_store_dev database.');
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6 || password.length > 128) {
  throw new Error('Set a valid ADMIN_BOOTSTRAP_EMAIL and a 6-128 character local bootstrap password.');
}

const prisma = new PrismaClient();
async function main() {
  const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (existing) {
    if (existing.role !== 'ADMIN') throw new Error('The configured administrator email already belongs to a non-admin account; no changes were made.');
    console.log('Local administrator already exists; credentials and account state were not changed.');
    return;
  }
  await prisma.user.create({
    data: {
      email, name: 'مدير المتجر المحلي', role: 'ADMIN', provider: 'LOCAL',
      passwordHash: await hashPassword(password), mustChangePassword: true,
    },
    select: { id: true },
  });
  console.log('Local administrator created. Change the temporary password immediately after first sign-in.');
}

main().catch(() => { console.error('Local administrator bootstrap failed; check the database schema, generated Prisma client, and local administrator configuration.'); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
