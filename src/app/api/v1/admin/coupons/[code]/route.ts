import { prisma } from '@/lib/prisma';
import { requireRole } from '@/server/auth/guard';
import { audit } from '@/server/audit';
import { assertSameOrigin, handle, HttpError, ok, readJson } from '@/server/http';
import { parseCoupon } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  assertSameOrigin(req);
  const actor = await requireRole(req, ['ADMIN']);
  const { code } = await ctx.params;
  const input = parseCoupon(await readJson(req));
  const data = input;
  const categoryIds = data.categoryIds;
  const productIds = data.productIds;
  const [categoryCount, productCount] = await Promise.all([
    categoryIds.length ? prisma.category.count({ where: { id: { in: categoryIds } } }) : 0,
    productIds.length ? prisma.product.count({ where: { id: { in: productIds } } }) : 0,
  ]);
  if (categoryCount !== new Set(categoryIds).size || productCount !== new Set(productIds).size) throw new HttpError(400, 'eligibility_invalid', 'بعض التصنيفات أو المنتجات المحددة غير موجودة.');
  await prisma.$transaction(async (tx) => {
    const before = await tx.coupon.findUnique({ where: { code } });
    if (!before) throw new HttpError(404, 'not_found', 'الكوبون غير موجود.');
    if (data.maxUses !== null && data.maxUses < before.uses) throw new HttpError(400, 'usage_limit', 'حد الاستخدام لا يمكن أن يقل عن عدد مرات الاستخدام الحالي.');
    const updated = await tx.coupon.update({ where: { code }, data });
    await audit(tx, actor.id, 'coupon.update', 'Coupon', code, before, { ...updated, uses: before.uses });
  });
  return ok({});
});
