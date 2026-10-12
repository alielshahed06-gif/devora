import { prisma } from "@/lib/prisma";
import { requireRole } from "@/server/auth/guard";
import { handle, ok, HttpError } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const STATUSES = ["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "DELIVERED", "CANCELLED"];
const PAY = ["AWAITING_PAYMENT", "PENDING_REVIEW", "PAID"];

export const GET = handle(async (req: Request) => {
  await requireRole(req, ["ADMIN", "STAFF"]);
  const sp = new URL(req.url).searchParams;
  const status = STATUSES.find((s) => s === sp.get("status")), paymentStatus = PAY.find((s) => s === sp.get("paymentStatus"));
  const page = Math.max(1, Math.floor(Number(sp.get("page") ?? 1)) || 1);
  const query = (sp.get("q") ?? '').trim().slice(0, 100);
  const and: object[] = [];
  if (query) {
    const number = query.match(/^(?:DX[-\s]?)?(\d+)$/i)?.[1];
    and.push({ OR: [
      { customerName: { contains: query, mode: 'insensitive' } },
      { customerPhone: { contains: query } },
      ...(number && Number.isSafeInteger(Number(number)) ? [{ number: Number(number) }] : []),
    ] });
  }
  const from = sp.get('from'), to = sp.get('to');
  const parseDate = (value: string | null) => {
    if (value === null) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, "validation", "صيغة التاريخ غير صحيحة.");
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new HttpError(400, "validation", "التاريخ غير صحيح.");
    }
    return date;
  };
  const fromDate = parseDate(from), toDate = parseDate(to);
  if (fromDate && toDate && fromDate > toDate) throw new HttpError(400, "validation", "تاريخ البداية يجب ألا يتجاوز تاريخ النهاية.");
  if (fromDate) and.push({ createdAt: { gte: fromDate } });
  if (toDate) {
    const nextDay = new Date(toDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    and.push({ createdAt: { lt: nextDay } });
  }
  const where = { ...(status ? { status: status as never } : {}), ...(paymentStatus ? { paymentStatus: paymentStatus as never } : {}), ...(and.length ? { AND: and } : {}) };
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 30, take: 30,
      select: { id: true, number: true, customerName: true, customerPhone: true, status: true, paymentStatus: true, paymentMethod: true, deliveryMethod: true, total: true, createdAt: true } }),
  ]);
  return ok({ total, page, orders });
});
