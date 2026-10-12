import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/server/auth/guard';
import { assertSameOrigin, handle, ok, readJson, HttpError } from '@/server/http';
import { audit } from '@/server/audit';
import { DEFAULT_STOREFRONT_SETTINGS, parseStorefrontSettings, type StorefrontSettings } from '@/server/storefront-settings';
import { isSafeProductImageUrl } from '@/server/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const KEYS = ['shippingFee', 'freeShippingMin'] as const;

export const GET = handle(async (req: Request) => {
  await requireRole(req, ['ADMIN']);
  const settings = await prisma.storeSetting.findMany({ where: { key: { in: [...KEYS] } } });
  const value = (key: typeof KEYS[number]) => {
    const stored = settings.find((setting) => setting.key === key)?.value;
    return typeof stored === 'number' && Number.isSafeInteger(stored) ? stored : null;
  };
  const storefrontRow = await prisma.storeSetting.findUnique({ where: { key: 'storefront' }, select: { value: true } });
  return ok({ settings: { shippingFee: value('shippingFee') ?? 0, freeShippingMin: value('freeShippingMin'), storefront: parseStorefrontSettings(storefrontRow?.value) } });
});

export const PATCH = handle(async (req: Request) => {
  assertSameOrigin(req);
  const actor = await requireRole(req, ['ADMIN']);
  const input = await readJson(req);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'validation', 'بيانات الإعدادات غير صحيحة.');
  const body = input as Record<string, unknown>;
  const keys = Object.keys(body);
  const allowed = [...KEYS, 'storefront'];
  if (!keys.length || keys.some((key) => !allowed.includes(key))) {
    throw new HttpError(400, 'validation', 'الإعدادات المرسلة غير مدعومة.');
  }
  for (const key of keys) {
    const value = body[key];
    if (key === 'shippingFee' && (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 100_000_000)) {
      throw new HttpError(400, 'validation', 'رسوم الشحن يجب أن تكون رقمًا صحيحًا غير سالب.');
    }
    if (key === 'freeShippingMin' && value !== null && (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0 || value > 100_000_000)) {
      throw new HttpError(400, 'validation', 'حد الشحن المجاني يجب أن يكون مبلغًا موجبًا أو فارغًا.');
    }
  }
  let storefront: StorefrontSettings | undefined;
  if ('storefront' in body) {
    const value = body.storefront;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'validation', 'إعدادات المتجر غير صحيحة.');
    const input = value as Record<string, unknown>;
    const current = parseStorefrontSettings((await txStorefrontValue()) ?? DEFAULT_STOREFRONT_SETTINGS);
    const socialInput = input.socialLinks;
    if (socialInput !== undefined && (!socialInput || typeof socialInput !== 'object' || Array.isArray(socialInput))) {
      throw new HttpError(400, 'validation', 'روابط التواصل غير صحيحة.');
    }
    const socialFields = ['facebook', 'instagram', 'whatsapp'];
    if (socialInput && Object.keys(socialInput).some((key) => !socialFields.includes(key))) {
      throw new HttpError(400, 'validation', 'يوجد رابط تواصل غير مدعوم.');
    }
    const merged = { ...current, ...input, socialLinks: { ...current.socialLinks, ...(socialInput as Record<string, unknown> | undefined) } };
    const allowedFields = ['storeName', 'logoUrl', 'tagline', 'homeTitle', 'homeDescription', 'announcement', 'supportPhone', 'supportTechnicalPhone', 'supportEmail', 'footerText', 'socialLinks'];
    if (Object.keys(input).some((key) => !allowedFields.includes(key))) throw new HttpError(400, 'validation', 'يوجد حقل غير مدعوم في إعدادات المتجر.');
    const limits = [
      ['storeName', merged.storeName, 100], ['logoUrl', merged.logoUrl, 1000], ['tagline', merged.tagline, 300],
      ['homeTitle', merged.homeTitle, 160], ['homeDescription', merged.homeDescription, 600], ['announcement', merged.announcement, 240],
      ['supportPhone', merged.supportPhone, 30], ['supportTechnicalPhone', merged.supportTechnicalPhone, 30],
      ['supportEmail', merged.supportEmail, 120], ['footerText', merged.footerText, 500],
    ] as const;
    for (const [key, field, max] of limits) {
      if (typeof field !== 'string' || field.length > max || ((key === 'storeName' || key === 'homeTitle') && field.trim().length < 2)) {
        throw new HttpError(400, 'validation', `قيمة ${key} غير صحيحة.`);
      }
    }
    if (merged.logoUrl && !isSafeProductImageUrl(merged.logoUrl)) throw new HttpError(400, 'validation', 'رابط الشعار يجب أن يكون محليًا آمنًا أو HTTPS.');
    if (merged.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(merged.supportEmail)) throw new HttpError(400, 'validation', 'البريد الإلكتروني للتواصل غير صحيح.');
    const social = merged.socialLinks;
    if (!social || typeof social !== 'object' || Object.values(social).some((url) => typeof url !== 'string' || (url !== '' && !isSafeProductImageUrl(url)))) {
      throw new HttpError(400, 'validation', 'روابط التواصل يجب أن تكون روابط HTTPS صحيحة.');
    }
    storefront = merged;
  }
  await prisma.$transaction(async (tx) => {
    for (const key of keys.filter((candidate) => KEYS.includes(candidate as typeof KEYS[number])) as (typeof KEYS[number])[]) {
      const value = body[key];
      const before = await tx.storeSetting.findUnique({ where: { key } });
      const storedValue = value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
      await tx.storeSetting.upsert({
        where: { key },
        update: { value: storedValue },
        create: { key, value: storedValue },
      });
      await audit(tx, actor.id, 'store_setting.update', 'StoreSetting', key, before?.value ?? null, value);
    }
    if (storefront) {
      const before = await tx.storeSetting.findUnique({ where: { key: 'storefront' } });
      await tx.storeSetting.upsert({
        where: { key: 'storefront' },
        update: { value: storefront as unknown as Prisma.InputJsonValue },
        create: { key: 'storefront', value: storefront as unknown as Prisma.InputJsonValue },
      });
      await audit(tx, actor.id, 'store_setting.update', 'StoreSetting', 'storefront', before?.value ?? null, storefront);
    }
  });
  return ok({});
});

async function txStorefrontValue() {
  return (await prisma.storeSetting.findUnique({ where: { key: 'storefront' }, select: { value: true } }))?.value;
}
