import { prisma } from '@/lib/prisma';
import { requireRole } from '@/server/auth/guard';
import { audit } from '@/server/audit';
import { assertSameOrigin, handle, HttpError, ok, readJson } from '@/server/http';
import { parseBranch } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const actor = await requireRole(req, ['ADMIN']);
  const { id } = await ctx.params;
  const raw = await readJson(req);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new HttpError(400, 'validation', 'بيانات الفرع غير صحيحة.');
  const data = parseBranch(raw as Record<string, unknown>);
  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.branch.findUnique({ where: { id } });
      if (!before) throw new HttpError(404, 'not_found', 'الفرع غير موجود.');
      await tx.branch.update({ where: { id }, data });
      await audit(tx, actor.id, 'branch.update', 'Branch', id, before, data);
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') throw new HttpError(409, 'duplicate', 'اسم الفرع مستخدم بالفعل.');
    throw error;
  }
  return ok({});
});
