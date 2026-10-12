/**
 * One-off admin bootstrap. Reads ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD (+ optional ADMIN_BOOTSTRAP_NAME) from the environment — nothing is hardcoded.
 * WRITES one row to the database the DATABASE_URL points at. Do not run until the owner has approved database writes.
 *   npx tsx scripts/create-admin.ts            (dry run: validates only)
 *   npx tsx scripts/create-admin.ts --apply    (creates/promotes the admin)
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/server/auth/password';

async function main() {
  const email = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? '').trim().toLowerCase(), password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) throw new Error('Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD (>= 12 chars).');
  if (!process.argv.includes('--apply')) { console.log('Dry run OK. Re-run with --apply to write.'); return; }
  const prisma = new PrismaClient();
  try {
    const passwordHash = await hashPassword(password);
    const u = await prisma.user.upsert({ where: { email }, update: { role: 'ADMIN', passwordHash }, create: { email, name: process.env.ADMIN_BOOTSTRAP_NAME || 'Admin', role: 'ADMIN', passwordHash, provider: 'LOCAL' }, select: { id: true } });
    console.log('Admin ready:', u.id);
  } finally { await prisma.$disconnect(); }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
