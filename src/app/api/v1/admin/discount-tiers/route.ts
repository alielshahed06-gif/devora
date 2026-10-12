import { prisma } from '@/lib/prisma';
import { requireRole } from '@/server/auth/guard';
import { audit } from '@/server/audit';
import { assertSameOrigin, handle, HttpError, ok, readJson } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  await requireRole(req, ['ADMIN']);
  return ok({ tiers: await prisma.discountTier.findMany({ orderBy: [{ minTotal: 'asc' }, { id: 'asc' }] }) });
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const actor = await requireRole(req, ['ADMIN']);
  const values = parseTier(await readJson(req));
  try {
    const tier = await prisma.$transaction(async (tx) => {
      const created = await tx.discountTier.create({ data: values });
      await audit(tx, actor.id, 'discount_tier.create', 'DiscountTier', created.id, null, values);
      return created;
    });
    return ok({ tier }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') throw new HttpError(409, 'duplicate', 'يوجد خصم بنفس الحد الأدنى.');
    throw error;
  }
});

export function parseTier(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new HttpError(400, 'validation', 'بيانات شريحة الخصم غير صحيحة.');
  const body = raw as Record<string, unknown>;
  if (Object.keys(body).some((key) => !['minTotal', 'ratePct'].includes(key)) || !('minTotal' in body) || !('ratePct' in body)) {
    throw new HttpError(400, 'validation', 'حد الخصم ونسبته مطلوبان فقط.');
  }
  const { minTotal, ratePct } = body;
  if (typeof minTotal !== 'number' || !Number.isSafeInteger(minTotal) || minTotal < 1 || minTotal > 100_000_000 ||
      typeof ratePct !== 'number' || !Number.isInteger(ratePct) || ratePct < 1 || ratePct > 100) {
    throw new HttpError(400, 'validation', 'يجب أن يكون حد الطلب موجبًا ونسبة الخصم بين 1 و100.');
  }
  return { minTotal, ratePct };
}
