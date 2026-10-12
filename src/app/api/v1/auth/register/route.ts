import { prisma } from "@/lib/prisma";
import { assertSameOrigin, clientIp, handle, ok, readJson, HttpError } from "@/server/http";
import { hashPassword } from "@/server/auth/password";
import { sessionCookie, sessionSecret, sessionVersion, signSession, SESSION_TTL_S } from "@/server/auth/session";
import { enforce, registerLimiter } from "@/server/limits";
import { parseRegister } from "@/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  enforce(registerLimiter, clientIp(req));
  const b = parseRegister(await readJson(req));
  const passwordHash = await hashPassword(b.password);
  // role is NEVER taken from the request: new accounts are always CUSTOMER.
  let user;
  try {
    user = await prisma.user.create({ data: { name: b.name, phone: b.phone, email: b.email, passwordHash, role: "CUSTOMER", provider: "LOCAL" }, select: { id: true, name: true, role: true } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new HttpError(409, "account_exists", "بيانات التسجيل مستخدمة بالفعل.");
    throw e;
  }
  const token = signSession({ uid: user.id, sv: sessionVersion(passwordHash), exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S }, sessionSecret());
  return ok({ user }, { status: 201, headers: { "Set-Cookie": sessionCookie(token) } });
});
