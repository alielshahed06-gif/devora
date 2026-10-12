import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/server/http";
import { paymentSelectable, type ConfigStatus } from "@/server/orders/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Only methods that are genuinely selectable are exposed (COD per store settings; online methods only when status = READY). Internal notes are never returned. */
export const GET = handle(async () => {
  const rows = await prisma.paymentMethodConfig.findMany({ orderBy: { sort: "asc" } });
  const methods = rows.filter((r) => paymentSelectable(r.code, { code: r.code, enabled: r.enabled, status: r.status as ConfigStatus })).map((r) => ({ code: r.code, name: r.name, description: r.description }));
  return ok({ methods });
});
