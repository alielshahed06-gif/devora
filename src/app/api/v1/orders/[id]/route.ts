import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/guard";
import { handle, ok, HttpError } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { id } = await ctx.params;
  // Ownership is part of the query (prevents IDOR): other users' orders look like "not found".
  const order = await prisma.order.findFirst({ where: { id, userId: user.id }, include: { items: true, history: { orderBy: { at: "asc" } }, payments: { select: { id: true, method: true, status: true, amount: true, submittedAt: true } } } });
  if (!order) throw new HttpError(404, "not_found", "الطلب غير موجود.");
  return ok({ order });
});
