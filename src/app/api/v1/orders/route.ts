import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/guard";
import { assertSameOrigin, clientIp, handle, ok, readJson } from "@/server/http";
import { createOrder } from "@/server/orders/createOrder";
import { prismaOrderRunner } from "@/server/orders/prismaStore";
import { enforce, orderLimiter } from "@/server/limits";
import { parseCheckout } from "@/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const user = await requireUser(req);
  enforce(orderLimiter, `${user.id}|${clientIp(req)}`);
  const input = parseCheckout(await readJson(req));
  const r = await createOrder(prismaOrderRunner, input, user.id);
  // Payment is NOT confirmed here: the order is created with paymentStatus AWAITING_PAYMENT for every method.
  return ok({ order: { id: r.id, number: r.number, total: r.total, paymentStatus: "AWAITING_PAYMENT" }, duplicate: r.duplicate }, { status: r.duplicate ? 200 : 201 });
});

export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  const orders = await prisma.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50,
    select: { id: true, number: true, status: true, paymentStatus: true, paymentMethod: true, total: true, createdAt: true } });
  return ok({ orders });
});
