import { prisma } from '../../lib/prisma';
import { HttpError } from '../http';
import { parseCookies, SESSION_COOKIE, sessionSecret, sessionVersion, verifySession } from './session';

export interface AuthUser { id: string; name: string; email: string | null; phone: string | null; role: 'CUSTOMER' | 'STAFF' | 'ADMIN'; mustChangePassword: boolean; sessionGeneration: number }

/** Resolves the session cookie to a DB user. Role is always read from the DB so demotions/password changes take effect immediately. */
export async function getUser(req: Request): Promise<AuthUser | null> {
  const token = parseCookies(req.headers.get('cookie'))[SESSION_COOKIE];
  const claims = verifySession(token, sessionSecret());
  if (!claims) return null;
  const u = await prisma.user.findUnique({ where: { id: claims.uid }, select: { id: true, name: true, email: true, phone: true, role: true, passwordHash: true, mustChangePassword: true, sessionGeneration: true } });
  if (!u || sessionVersion(u.passwordHash, u.sessionGeneration) !== claims.sv) return null;
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, mustChangePassword: u.mustChangePassword, sessionGeneration: u.sessionGeneration };
}
export async function requireUser(req: Request): Promise<AuthUser> {
  const u = await getUser(req);
  if (!u) throw new HttpError(401, 'unauthenticated', 'يجب تسجيل الدخول.');
  return u;
}
export async function requireRole(req: Request, roles: AuthUser['role'][]): Promise<AuthUser> {
  const u = await requireUser(req);
  if (!roles.includes(u.role)) throw new HttpError(403, 'forbidden', 'غير مصرّح لك بهذا الإجراء.');
  if (u.role === 'ADMIN' && u.mustChangePassword) throw new HttpError(403, 'password_change_required', 'غيّر كلمة مرور المدير قبل استخدام لوحة الإدارة.');
  return u;
}
