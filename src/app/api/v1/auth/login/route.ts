import { prisma } from "@/lib/prisma";
import { assertSameOrigin, clientIp, handle, ok, readJson, HttpError } from "@/server/http";
import { verifyPassword } from "@/server/auth/password";
import { sessionCookie, sessionSecret, sessionVersion, signSession, SESSION_TTL_S } from "@/server/auth/session";
import { enforce, loginLimiter } from "@/server/limits";
import { parseLogin } from "@/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const b = parseLogin(await readJson(req));
  enforce(loginLimiter, `${clientIp(req)}|${b.email ?? b.phone}`);
  const user = await prisma.user.findFirst({ where: b.email ? { email: b.email } : { phone: b.phone ?? "" }, select: { id: true, name: true, role: true, passwordHash: true, mustChangePassword: true, sessionGeneration: true } });
  const valid = await verifyPassword(b.password, user?.passwordHash); // always hashes, so timing doesn't reveal whether the account exists
  if (!user || !valid) throw new HttpError(401, "invalid_credentials", "بيانات الدخول غير صحيحة.");
  if (process.env.NODE_ENV === "production" && user.role === "ADMIN" && user.mustChangePassword) {
    throw new HttpError(403, "password_change_required", "يجب استبدال كلمة مرور المدير المؤقتة محليًا قبل النشر.");
  }
  const token = signSession({ uid: user.id, sv: sessionVersion(user.passwordHash, user.sessionGeneration), exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S }, sessionSecret());
  return ok({ user: { id: user.id, name: user.name, role: user.role, mustChangePassword: user.mustChangePassword } }, { headers: { "Set-Cookie": sessionCookie(token) } });
});
