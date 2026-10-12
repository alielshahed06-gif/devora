import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/guard";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { assertSameOrigin, handle, ok, readJson, HttpError } from "@/server/http";
import { sessionCookie, sessionSecret, sessionVersion, signSession, SESSION_TTL_S } from "@/server/auth/session";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const actor = await requireUser(req);
  if (actor.role !== "ADMIN") throw new HttpError(403, "forbidden", "هذه العملية متاحة لمدير المتجر فقط.");
  const raw = await readJson(req);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new HttpError(400, "validation", "بيانات كلمة المرور غير صحيحة.");
  const body = raw as { currentPassword?: unknown; newPassword?: unknown };
  if (typeof body.currentPassword !== "string" || typeof body.newPassword !== "string" || body.newPassword.length < 12 || body.newPassword.length > 128) {
    throw new HttpError(400, "validation", "كلمة المرور الجديدة يجب أن تكون 12 حرفًا على الأقل.");
  }
  const current = await prisma.user.findUnique({ where: { id: actor.id }, select: { passwordHash: true, sessionGeneration: true } });
  if (!current || !(await verifyPassword(body.currentPassword, current.passwordHash))) {
    throw new HttpError(401, "invalid_credentials", "كلمة المرور الحالية غير صحيحة.");
  }
  if (body.currentPassword === body.newPassword) throw new HttpError(400, "validation", "اختر كلمة مرور مختلفة عن الحالية.");

  const passwordHash = await hashPassword(body.newPassword);
  await prisma.$transaction(async (tx) => {
    const changed = await tx.user.updateMany({
      where: { id: actor.id, passwordHash: current.passwordHash, sessionGeneration: current.sessionGeneration },
      data: { passwordHash, mustChangePassword: false, sessionGeneration: { increment: 1 } },
    });
    if (changed.count !== 1) throw new HttpError(409, "password_changed", "تغيّرت بيانات الحساب. سجّل الدخول مجددًا.");
    await audit(tx, actor.id, "admin.password.change", "User", actor.id, null, { mustChangePassword: false });
  });
  const token = signSession({ uid: actor.id, sv: sessionVersion(passwordHash, current.sessionGeneration + 1), exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S }, sessionSecret());
  return ok({}, { headers: { "Set-Cookie": sessionCookie(token) } });
});
