import { prisma } from "@/lib/prisma";
import { requireRole } from "@/server/auth/guard";
import { assertSameOrigin, handle, ok, readJson, HttpError } from "@/server/http";
import { PAYMENT_CODES } from "@/server/validate";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const STATUSES = ["NOT_CONFIGURED", "SANDBOX", "AWAITING_APPROVAL", "READY", "DISABLED", "BLOCKED"] as const;

/** READY (customer-visible) requires documented integration/verification notes, so a method cannot be switched on blindly. */
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  assertSameOrigin(req);
  const actor = await requireRole(req, ["ADMIN"]);
  const { code } = await ctx.params;
  const c = PAYMENT_CODES.find((x) => x === code);
  if (!c) throw new HttpError(404, "not_found", "وسيلة دفع غير معروفة.");
  const b = (await readJson(req)) as { status?: unknown; enabled?: unknown; integrationNotes?: unknown };
  const data: { status?: (typeof STATUSES)[number]; enabled?: boolean; integrationNotes?: string } = {};
  if (b.status !== undefined) { const s = STATUSES.find((x) => x === b.status); if (!s) throw new HttpError(400, "validation", "حالة غير صحيحة."); data.status = s; }
  if (c !== "COD" && data.status === "READY") throw new HttpError(422, "provider_unverified", "لا يوجد تكامل بوابة دفع موثّق ومختبَر؛ تبقى وسائل الدفع الإلكتروني غير متاحة.");
  if (b.enabled !== undefined) { if (typeof b.enabled !== "boolean") throw new HttpError(400, "validation", "قيمة غير صحيحة."); data.enabled = b.enabled; }
  if (b.integrationNotes !== undefined) { if (typeof b.integrationNotes !== "string" || b.integrationNotes.length > 2000) throw new HttpError(400, "validation", "ملاحظات غير صحيحة."); data.integrationNotes = b.integrationNotes; }
  await prisma.$transaction(async (tx) => {
    const cur = await tx.paymentMethodConfig.findUnique({ where: { code: c } });
    if (!cur) throw new HttpError(404, "not_found", "وسيلة الدفع غير موجودة في قاعدة البيانات.");
    const notes = data.integrationNotes ?? cur.integrationNotes;
    if (data.status === "READY" && c !== "COD" && notes.trim().length < 20) throw new HttpError(422, "notes_required", "لا يمكن تفعيل الوسيلة قبل توثيق التكامل وطريقة التحقق في الملاحظات.");
    await tx.paymentMethodConfig.update({ where: { code: c }, data });
    await audit(tx, actor.id, "payment_method.update", "PaymentMethodConfig", c, { status: cur.status, enabled: cur.enabled }, data);
  });
  return ok({});
});
