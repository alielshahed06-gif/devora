import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async () => ok({ branches: await prisma.branch.findMany({ where: { active: true, pickupEnabled: true }, orderBy: { sort: "asc" }, select: { id: true, name: true, address: true, hours: true, phone: true, mapUrl: true } }) }));
