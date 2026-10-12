import { prisma } from "@/lib/prisma";
import { requireRole } from "@/server/auth/guard";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireRole(req, ["ADMIN"]);
  return ok({ methods: await prisma.paymentMethodConfig.findMany({ orderBy: { sort: "asc" } }) });
});
