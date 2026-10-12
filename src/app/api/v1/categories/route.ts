import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async () => ok({ categories: await prisma.category.findMany({ where: { active: true }, orderBy: { sort: "asc" }, select: { id: true, name: true } }) }));
