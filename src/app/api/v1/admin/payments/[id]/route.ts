import { prisma } from "@/lib/prisma";
import { requireRole } from "@/server/auth/guard";
import { assertSameOrigin, handle, ok, readJson, HttpError } from "@/server/http";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin verifies a submitted transfer (after checking the actual provider/bank statement). Only this path can set PAID for manual methods. */
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const actor = await requireRole(req, ["ADMIN"]);
  const { id } = await ctx.params;
  const decision = ((await readJson(req)) as { decision?: unknown })?.decision;
  if (decision !== "ACCEPT" && decision !== "REJECT") throw new HttpError(400, "validation", "قرار غير صحيح.");
  await prisma.$transaction(async (tx) => {
    const a = await tx.paymentAttempt.findUnique({ where: { id }, include: { order: true } });
    if (!a) throw new HttpError(404, "not_found", "غير موجود.");
    if (a.status !== "SUBMITTED") throw new HttpError(409, "already_reviewed", "تمت مراجعة هذه الدفعة.");
    if (a.method !== a.order.paymentMethod) throw new HttpError(409, "payment_method_mismatch", "وسيلة الدفع لا تطابق الطلب.");
    if (decision === "ACCEPT" && a.amount !== a.order.total) throw new HttpError(409, "amount_mismatch", "المبلغ لا يطابق إجمالي الطلب.");
    const claimed = await tx.paymentAttempt.updateMany({ where: { id, status: "SUBMITTED" }, data: { status: decision === "ACCEPT" ? "ACCEPTED" : "REJECTED", reviewedAt: new Date(), reviewedById: actor.id } });
    if (claimed.count !== 1) throw new HttpError(409, "conflict", "تمت مراجعة هذه الدفعة.");
    if (decision === "ACCEPT") {
      const paid = await tx.order.updateMany({
        where: { id: a.orderId, status: { not: "CANCELLED" }, paymentStatus: "PENDING_REVIEW" },
        data: { paymentStatus: "PAID" },
      });
      if (paid.count !== 1) throw new HttpError(409, "not_payable", "لا يمكن اعتماد دفعة لهذا الطلب.");
    } else {
      const anotherPending = await tx.paymentAttempt.findFirst({ where: { orderId: a.orderId, id: { not: id }, status: "SUBMITTED" }, select: { id: true } });
      await tx.order.updateMany({
        where: { id: a.orderId, paymentStatus: "PENDING_REVIEW" },
        data: { paymentStatus: anotherPending ? "PENDING_REVIEW" : "AWAITING_PAYMENT" },
      });
    }
    await audit(tx, actor.id, `payment.${decision.toLowerCase()}`, "PaymentAttempt", id, { status: a.status }, { decision });
  });
  return ok({ decision });
});
