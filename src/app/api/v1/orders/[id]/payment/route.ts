import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/guard";
import { assertSameOrigin, handle, ok, readJson, HttpError } from "@/server/http";
import { MANUAL_REFERENCE_METHODS } from "@/server/orders/rules";
import { parsePaymentReference } from "@/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Customer submits a transfer reference. This NEVER marks the order paid: it moves it to PENDING_REVIEW for an admin to verify. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const user = await requireUser(req);
  const { id } = await ctx.params;
  const b = parsePaymentReference(await readJson(req));
  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id, userId: user.id } });
      if (!order) throw new HttpError(404, "not_found", "الطلب غير موجود.");
      if (!MANUAL_REFERENCE_METHODS.includes(order.paymentMethod)) throw new HttpError(422, "not_manual", "وسيلة الدفع لا تدعم إدخال مرجع تحويل.");
      if (order.status === "CANCELLED" || order.paymentStatus === "PAID") throw new HttpError(409, "not_payable", "لا يمكن إضافة دفعة لهذا الطلب.");
      if (order.paymentStatus === "PENDING_REVIEW") throw new HttpError(409, "payment_pending_review", "بيانات الدفع قيد المراجعة بالفعل.");
      const claimed = await tx.order.updateMany({
        where: { id: order.id, userId: user.id, status: { not: "CANCELLED" }, paymentStatus: "AWAITING_PAYMENT" },
        data: { paymentStatus: "PENDING_REVIEW" },
      });
      if (claimed.count !== 1) throw new HttpError(409, "not_payable", "تعذّر تسجيل الدفع لهذا الطلب.");
      await tx.paymentAttempt.create({ data: { orderId: order.id, method: order.paymentMethod, reference: b.reference, senderPhone: b.senderPhone, amount: order.total } });
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new HttpError(409, "reference_used", "هذا المرجع مستخدم من قبل.");
    throw e;
  }
  return ok({ paymentStatus: "PENDING_REVIEW" }, { status: 201 });
});
