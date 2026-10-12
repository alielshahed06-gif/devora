import { prisma } from '@/lib/prisma';
import { requireRole } from '@/server/auth/guard';
import { assertSameOrigin, handle, ok, readJson, HttpError } from '@/server/http';
import { isSafeProductImageUrl } from '@/server/validate';
import { audit } from '@/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const actor = await requireRole(req, ['ADMIN']);
  const { id } = await ctx.params;
  const raw = await readJson(req);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new HttpError(400, 'validation', 'بيانات التصنيف غير صحيحة.');
  const body = raw as Record<string, unknown>;
  const allowed = ['name', 'description', 'imageUrl', 'active', 'sort'];
  if (!Object.keys(body).length || Object.keys(body).some((key) => !allowed.includes(key))) throw new HttpError(400, 'validation', 'لا توجد تغييرات صالحة للتصنيف.');
  const data: { name?: string; description?: string; imageUrl?: string | null; active?: boolean; sort?: number } = {};
  if ('name' in body) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 80) throw new HttpError(400, 'validation', 'اسم التصنيف مطلوب (2 إلى 80 حرفًا).');
    data.name = body.name.trim();
  }
  if ('description' in body) {
    if (typeof body.description !== 'string' || body.description.length > 500) throw new HttpError(400, 'validation', 'الوصف لا يتجاوز 500 حرف.');
    data.description = body.description.trim();
  }
  if ('imageUrl' in body) {
    if (body.imageUrl !== null && body.imageUrl !== '' && (typeof body.imageUrl !== 'string' || !isSafeProductImageUrl(body.imageUrl))) {
      throw new HttpError(400, 'validation', 'رابط صورة التصنيف يجب أن يكون محليًا آمنًا أو HTTPS.');
    }
    data.imageUrl = typeof body.imageUrl === 'string' && body.imageUrl ? body.imageUrl : null;
  }
  if ('active' in body) {
    if (typeof body.active !== 'boolean') throw new HttpError(400, 'validation', 'حالة النشر غير صحيحة.');
    data.active = body.active;
  }
  if ('sort' in body) {
    if (typeof body.sort !== 'number' || !Number.isInteger(body.sort) || body.sort < 0 || body.sort > 100_000) throw new HttpError(400, 'validation', 'ترتيب التصنيف غير صحيح.');
    data.sort = body.sort;
  }
  await prisma.$transaction(async (tx) => {
    const before = await tx.category.findUnique({ where: { id } });
    if (!before) throw new HttpError(404, 'not_found', 'التصنيف غير موجود.');
    await tx.category.update({ where: { id }, data });
    await audit(tx, actor.id, 'category.update', 'Category', id, before, data);
  });
  return ok({});
});
