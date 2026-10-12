import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/server/http";
import { parseProductQuery } from "@/server/validate";
import { publicProduct, PRODUCT_INCLUDE } from "@/server/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const f = parseProductQuery(new URL(req.url).searchParams);
  const where = {
    active: true,
    category: { is: { active: true } },
    ...(f.category ? { categoryId: f.category } : {}),
    ...(f.offers ? { salePrice: { not: null } } : {}),
    ...(f.available ? { variants: { some: { stock: { gt: 0 } } } } : {}),
    ...(f.q ? { OR: [{ name: { contains: f.q, mode: "insensitive" as const } }, { description: { contains: f.q, mode: "insensitive" as const } }] } : {}),
  };
  const orderBy = f.sort === "price_asc" ? { price: "asc" as const } : f.sort === "price_desc" ? { price: "desc" as const } : { createdAt: "desc" as const };
  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({ where, include: PRODUCT_INCLUDE, orderBy, skip: (f.page - 1) * f.pageSize, take: f.pageSize }),
  ]);
  return ok({ count: rows.length, total, page: f.page, pageSize: f.pageSize, products: rows.map(publicProduct) });
});
