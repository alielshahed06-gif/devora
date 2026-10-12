import { prisma } from "@/lib/prisma";
import { requireRole } from "@/server/auth/guard";
import { assertSameOrigin, handle, ok, readJson, HttpError } from "@/server/http";
import { paymentStatusAfterTransition, transitionError, type OrderStatus } from "@/server/orders/rules";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const STATUSES = ["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "DELIVERED", "CANCELLED"] as const;

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireRole(req, ["ADMIN", "STAFF"]);
  const { id } = await ctx.params;
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true, history: { orderBy: { at: "asc" } }, payments: true } });
  if (!order) throw new HttpError(404, "not_found", "الطلب غير موجود.");
  return ok({ order });
});

/** Change fulfilment status. Transition rules live in rules.ts; cancelling returns reserved stock. */
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const actor = await requireRole(req, ["ADMIN", "STAFF"]);
  const { id } = await ctx.params;
  const body = (await readJson(req)) as { status?: unknown };
  const to = STATUSES.find((s) => s === body?.status);
  if (!to) throw new HttpError(400, "validation", "حالة غير صحيحة.");
  const updated = await prisma.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { id }, include: { items: true } });
    if (!o) throw new HttpError(404, "not_found", "الطلب غير موجود.");
    const err = transitionError({ from: o.status as OrderStatus, to, deliveryMethod: o.deliveryMethod, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus });
    if (err) throw new HttpError(409, err, "لا يمكن تنفيذ هذا الانتقال.");
    const paymentStatus = paymentStatusAfterTransition(to, o.paymentMethod, o.paymentStatus);
    const res = await tx.order.updateMany({ where: { id, status: o.status, paymentStatus: o.paymentStatus }, data: { status: to, paymentStatus } });
    if (res.count !== 1) throw new HttpError(409, "conflict", "تم تعديل الطلب من مستخدم آخر.");
    await tx.orderStatusHistory.create({ data: { orderId: id, status: to } });
    if (to === "CANCELLED") for (const it of o.items) if (it.variantId) await tx.productVariant.updateMany({ where: { id: it.variantId }, data: { stock: { increment: it.qty } } });
    await audit(tx, actor.id, "order.status.update", "Order", id, { status: o.status, paymentStatus: o.paymentStatus }, { status: to, paymentStatus });
    return { id, status: to, paymentStatus };
  });
  return ok({ order: updated });
});
