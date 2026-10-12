import { prisma } from "@/lib/prisma";
import { requireRole } from "@/server/auth/guard";
import { assertSameOrigin, handle, ok, readJson, HttpError } from "@/server/http";
import { audit } from "@/server/audit";
import { isSafeProductImageUrl } from "@/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireRole(req, ["ADMIN"]);
  const categories = await prisma.category.findMany({ orderBy: { sort: "asc" }, include: { _count: { select: { products: true } } } });
  return ok({ categories });
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const actor = await requireRole(req, ["ADMIN"]);
  const raw = await readJson(req);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new HttpError(400, "validation", "بيانات غير صحيحة.");
  const b = raw as { id?: unknown; name?: unknown; sort?: unknown; description?: unknown; imageUrl?: unknown; active?: unknown };
  const id = b.id;
  const name = b.name;
  if (typeof id !== "string" || !/^[a-z0-9-]{2,40}$/.test(id) || typeof name !== "string" || name.trim().length < 2 || name.length > 80) throw new HttpError(400, "validation", "بيانات غير صحيحة.");
  const sort = b.sort === undefined ? 0 : b.sort;
  if (typeof sort !== "number" || !Number.isInteger(sort) || sort < 0 || sort > 100_000) throw new HttpError(400, "validation", "ترتيب التصنيف غير صحيح.");
  const description = b.description ?? "";
  if (typeof description !== "string" || description.length > 500) throw new HttpError(400, "validation", "وصف التصنيف غير صحيح.");
  const imageUrl = b.imageUrl == null || b.imageUrl === "" ? null : b.imageUrl;
  if (imageUrl !== null && (typeof imageUrl !== "string" || !isSafeProductImageUrl(imageUrl))) throw new HttpError(400, "validation", "رابط صورة التصنيف يجب أن يكون محليًا آمنًا أو HTTPS.");
  const active = b.active === undefined ? true : b.active;
  if (typeof active !== "boolean") throw new HttpError(400, "validation", "حالة النشر غير صحيحة.");
  try {
    await prisma.$transaction(async (tx) => {
      await tx.category.create({ data: { id, name: name.trim(), sort, description, imageUrl, active } });
      await audit(tx, actor.id, "category.create", "Category", id, null, { name, active });
    });
  } catch (e) { if ((e as { code?: string }).code === "P2002") throw new HttpError(409, "duplicate", "التصنيف موجود."); throw e; }
  return ok({}, { status: 201 });
});
