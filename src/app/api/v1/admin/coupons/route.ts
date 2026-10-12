import { CouponType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/server/auth/guard';
import { audit } from '@/server/audit';
import { assertSameOrigin, handle, HttpError, ok, readJson } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type CouponData = {
  label: string; type: CouponType; value: number; minOrder: number; active: boolean; startsAt: Date | null;
  expiresAt: Date | null; maxUses: number | null; categoryIds: string[]; productIds: string[];
};
type CouponCreateData = CouponData & { code: string };
type CouponUpdateData = CouponData;

export const GET = handle(async (req: Request) => {
  await requireRole(req, ['ADMIN']);
  const [coupons, categories, products] = await Promise.all([
    prisma.coupon.findMany({ orderBy: { code: 'asc' } }),
    prisma.category.findMany({ orderBy: { sort: 'asc' }, select: { id: true, name: true, active: true } }),
    prisma.product.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, active: true, categoryId: true } }),
  ]);
  return ok({ coupons, categories, products });
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const actor = await requireRole(req, ['ADMIN']);
  const input = parseCoupon(await readJson(req), true);
  await validateEligibility(input.categoryIds, input.productIds);
  try {
    const coupon = await prisma.$transaction(async (tx) => {
      const created = await tx.coupon.create({ data: input });
      await audit(tx, actor.id, 'coupon.create', 'Coupon', created.code, null, { ...input, uses: 0 });
      return created;
    });
    return ok({ coupon }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') throw new HttpError(409, 'duplicate', 'كود الخصم مستخدم بالفعل.');
    throw error;
  }
});

export function parseCoupon(raw: unknown, creating: true): CouponCreateData;
export function parseCoupon(raw: unknown, creating?: false): CouponUpdateData;
export function parseCoupon(raw: unknown, creating = false): CouponCreateData | CouponUpdateData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new HttpError(400, 'validation', 'بيانات الكوبون غير صحيحة.');
  const body = raw as Record<string, unknown>;
  const allowed = ['code', 'label', 'type', 'value', 'minOrder', 'active', 'startsAt', 'expiresAt', 'maxUses', 'categoryIds', 'productIds'];
  if (Object.keys(body).some((key) => !allowed.includes(key))) throw new HttpError(400, 'validation', 'يوجد حقل غير مدعوم في الكوبون.');
  const code = body.code;
  const label = body.label;
  const type = body.type;
  const value = body.value;
  const minOrder = body.minOrder;
  const active = body.active;
  const startsAt = dateField(body.startsAt, 'بداية الكوبون');
  const expiresAt = dateField(body.expiresAt, 'انتهاء الكوبون', true);
  const maxUses = body.maxUses === '' || body.maxUses === null ? null : body.maxUses;
  const categoryIds = body.categoryIds;
  const productIds = body.productIds;
  if ((creating && (typeof code !== 'string' || !/^[A-Z0-9_-]{3,20}$/.test(code))) ||
      (!creating && code !== undefined && (typeof code !== 'string' || !/^[A-Z0-9_-]{3,20}$/.test(code)))) {
    throw new HttpError(400, 'validation', 'كود الخصم من 3 إلى 20 حرفًا إنجليزيًا كبيرًا أو رقمًا أو شرطة.');
  }
  if (typeof label !== 'string' || label.trim().length < 2 || label.trim().length > 100 ||
      (type !== 'PERCENT' && type !== 'FIXED') || typeof value !== 'number' || !Number.isSafeInteger(value) ||
      value < 1 || value > 100_000_000 || (type === 'PERCENT' && value > 100) ||
      typeof minOrder !== 'number' || !Number.isSafeInteger(minOrder) || minOrder < 0 || minOrder > 100_000_000 ||
      typeof active !== 'boolean' ||
      (maxUses !== null && (typeof maxUses !== 'number' || !Number.isSafeInteger(maxUses) || maxUses < 1 || maxUses > 1_000_000)) ||
      !stringIds(categoryIds) || !stringIds(productIds)) {
    throw new HttpError(400, 'validation', 'تحقق من اسم الكوبون وقيمته والحد الأدنى والاستخدامات والمنتجات المؤهلة.');
  }
  if (startsAt && expiresAt && startsAt >= expiresAt) throw new HttpError(400, 'validation', 'تاريخ بداية الكوبون يجب أن يسبق تاريخ انتهائه.');
  const data: CouponData = {
    label: label.trim(),
    type: type as CouponType,
    value,
    minOrder,
    active,
    startsAt,
    expiresAt,
    maxUses,
    categoryIds: [...new Set(categoryIds as string[])],
    productIds: [...new Set(productIds as string[])],
  };
  return creating ? { ...data, code: code as string } : data;
}

function dateField(value: unknown, label: string, nullable = false): Date | null {
  if (value === null || value === '') {
    if (nullable || value === null) return null;
    return null;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z)?$/.test(value)) {
    throw new HttpError(400, 'validation', `${label} غير صحيح.`);
  }
  const date = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value.slice(0, 10)) throw new HttpError(400, 'validation', `${label} غير صحيح.`);
  if (value.length === 10 && label.startsWith('انتهاء')) date.setUTCHours(23, 59, 59, 999);
  return date;
}

function stringIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 200 && value.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 64);
}

async function validateEligibility(categoryIds: string[], productIds: string[]) {
  const [categories, products] = await Promise.all([
    categoryIds.length ? prisma.category.count({ where: { id: { in: categoryIds } } }) : 0,
    productIds.length ? prisma.product.count({ where: { id: { in: productIds } } }) : 0,
  ]);
  if (categories !== new Set(categoryIds).size || products !== new Set(productIds).size) throw new HttpError(400, 'eligibility_invalid', 'بعض التصنيفات أو المنتجات المحددة غير موجودة.');
}
