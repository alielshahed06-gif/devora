import { prisma } from "@/lib/prisma";
import { getUser } from "@/server/auth/guard";
import { assertSameOrigin, handle, ok } from "@/server/http";
import { clearSessionCookie } from "@/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const user = await getUser(req);
  if (user) {
    await prisma.user.updateMany({
      where: { id: user.id, sessionGeneration: user.sessionGeneration },
      data: { sessionGeneration: { increment: 1 } },
    });
  }
  return ok({}, { headers: { "Set-Cookie": clearSessionCookie() } });
});
