import { prisma } from "@/lib/prisma";
import { handle, ok, HttpError } from "@/server/http";
import { publicProduct, PRODUCT_INCLUDE } from "@/server/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const p = await prisma.product.findFirst({ where: { active: true, OR: [{ id }, { legacyId: id }] }, include: PRODUCT_INCLUDE });
  if (!p) throw new HttpError(404, "not_found", "المنتج غير موجود.");
  return ok({ product: publicProduct(p) });
});
