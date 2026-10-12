import { prisma } from '@/lib/prisma';
import { requireRole } from '@/server/auth/guard';
import { audit } from '@/server/audit';
import { assertSameOrigin, handle, HttpError, ok, readJson } from '@/server/http';
import { parseTier } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const actor = await requireRole(req, ['ADMIN']);
  const { id } = await ctx.params;
  const data = parseTier(await readJson(req));
  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.discountTier.findUnique({ where: { id } });
      if (!before) throw new HttpError(404, 'not_found', 'شريحة الخصم غير موجودة.');
      await tx.discountTier.update({ where: { id }, data });
      await audit(tx, actor.id, 'discount_tier.update', 'DiscountTier', id, before, data);
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') throw new HttpError(409, 'duplicate', 'يوجد خصم بنفس الحد الأدنى.');
    throw error;
  }
  return ok({});
});

export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const actor = await requireRole(req, ['ADMIN']);
  const { id } = await ctx.params;
  await prisma.$transaction(async (tx) => {
    const before = await tx.discountTier.findUnique({ where: { id } });
    if (!before) throw new HttpError(404, 'not_found', 'شريحة الخصم غير موجودة.');
    await tx.discountTier.delete({ where: { id } });
    await audit(tx, actor.id, 'discount_tier.delete', 'DiscountTier', id, before, null);
  });
  return ok({});
});
