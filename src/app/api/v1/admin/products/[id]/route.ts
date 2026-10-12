import { prisma } from "@/lib/prisma";
import { requireRole } from "@/server/auth/guard";
import { assertSameOrigin, handle, ok, readJson, HttpError } from "@/server/http";
import { parseProductPatch, parseProductVariants } from "@/server/validate";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Update product details and existing/new size, color and stock variants. */
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const actor = await requireRole(req, ["ADMIN"]);
  const { id } = await ctx.params;
  const value = await readJson(req);
  const body = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const { variants, ...rest } = body;
  const changes = parseProductVariants(variants);
  const patch = Object.keys(rest).length || !changes.length ? parseProductPatch(rest) : {};
  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.product.findUnique({ where: { id }, select: { price: true, salePrice: true, active: true, name: true, legacyId: true } });
      if (!before) throw new HttpError(404, "not_found", "المنتج غير موجود.");
      const price = patch.price ?? before.price, sale = patch.salePrice === undefined ? before.salePrice : patch.salePrice;
      if (sale != null && sale >= price) throw new HttpError(400, "validation", "سعر التخفيض يجب أن يكون أقل من السعر.");
      if (patch.categoryId && !(await tx.category.findFirst({ where: { id: patch.categoryId, active: true }, select: { id: true } }))) {
        throw new HttpError(422, "category_invalid", "التصنيف غير موجود أو غير منشور.");
      }
      const { images, ...productPatch } = patch;
      if (Object.keys(productPatch).length) await tx.product.update({ where: { id }, data: productPatch });
      if (images !== undefined) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        if (images.length) await tx.productImage.createMany({ data: images.map((url, sort) => ({ productId: id, url, sort })) });
      }
      for (const variant of changes) {
        if (variant.id) {
          const result = await tx.productVariant.updateMany({
            where: { id: variant.id, productId: id },
            data: { stock: variant.stock, ...(variant.size === undefined ? {} : { size: variant.size }), ...(variant.color === undefined ? {} : { color: variant.color }), ...(variant.priceOverride === undefined ? {} : { priceOverride: variant.priceOverride }) },
          });
          if (result.count !== 1) throw new HttpError(422, "variant_invalid", "متغير غير صحيح.");
        } else {
          if (variant.size === undefined || variant.color === undefined) throw new HttpError(400, "validation", "المقاس واللون مطلوبان للمتغير الجديد.");
          await tx.productVariant.create({ data: { productId: id, size: variant.size, color: variant.color, stock: variant.stock, priceOverride: variant.priceOverride ?? null } });
        }
      }
      await audit(tx, actor.id, "product.update", "Product", id, before, { ...patch, ...(changes.length ? { variants: changes } : {}) });
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      const target = (error as { meta?: { target?: unknown } }).meta?.target;
      if ((Array.isArray(target) && target.some((field) => field === 'legacyId')) || (typeof target === 'string' && target.includes('legacyId'))) throw new HttpError(409, "product_identifier_duplicate", "معرّف المنتج مستخدم بالفعل.");
      throw new HttpError(409, "variant_duplicate", "هذا المقاس واللون مسجلان بالفعل.");
    }
    throw error;
  }
  return ok({});
});
