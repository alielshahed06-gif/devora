import { prisma } from "@/lib/prisma";
import { requireRole } from "@/server/auth/guard";
import { assertSameOrigin, handle, ok, readJson, HttpError } from "@/server/http";
import { parseProductCreate } from "@/server/validate";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireRole(req, ["ADMIN", "STAFF"]);
  const products = await prisma.product.findMany({ include: { variants: true, images: { orderBy: { sort: 'asc' } }, category: true }, orderBy: { updatedAt: "desc" }, take: 200 });
  return ok({ products });
});

/** New products are ALWAYS created inactive; activating is a separate, deliberate PATCH. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const actor = await requireRole(req, ["ADMIN"]);
  const b = parseProductCreate(await readJson(req));
  if (!(await prisma.category.findFirst({ where: { id: b.categoryId, active: true } }))) throw new HttpError(422, "category_invalid", "التصنيف غير موجود أو غير منشور.");
  try {
    const p = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({ data: { name: b.name, description: b.description, categoryId: b.categoryId, price: b.price, salePrice: b.salePrice, legacyId: b.legacyId, active: false,
        variants: { create: b.variants }, images: { create: b.images.map((url, sort) => ({ url, sort })) } }, select: { id: true } });
      await audit(tx, actor.id, "product.create", "Product", created.id, null, { name: b.name });
      return created;
    });
    return ok({ product: p }, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new HttpError(409, "duplicate", "المنتج موجود بالفعل.");
    throw e;
  }
});
