import { prisma } from '@/lib/prisma';
import { requireRole } from '@/server/auth/guard';
import { audit } from '@/server/audit';
import { assertSameOrigin, handle, HttpError, ok, readJson } from '@/server/http';
import { isSafeProductImageUrl } from '@/server/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  await requireRole(req, ['ADMIN']);
  return ok({ branches: await prisma.branch.findMany({ orderBy: [{ sort: 'asc' }, { name: 'asc' }] }) });
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const actor = await requireRole(req, ['ADMIN']);
  const raw = await readJson(req);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new HttpError(400, 'validation', 'بيانات الفرع غير صحيحة.');
  const body = raw as Record<string, unknown>;
  const data = parseBranch(body, true);
  try {
    const branch = await prisma.$transaction(async (tx) => {
      const created = await tx.branch.create({ data });
      await audit(tx, actor.id, 'branch.create', 'Branch', created.id, null, data);
      return created;
    });
    return ok({ branch }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') throw new HttpError(409, 'duplicate', 'اسم الفرع مستخدم بالفعل.');
    throw error;
  }
});

interface BranchData { name: string; address: string; hours: string; phone: string; mapUrl: string; active: boolean; pickupEnabled: boolean; sort: number }
export function parseBranch(body: Record<string, unknown>, creating: true): BranchData;
export function parseBranch(body: Record<string, unknown>, creating?: false): Partial<BranchData>;
export function parseBranch(body: Record<string, unknown>, creating = false): BranchData | Partial<BranchData> {
  const allowed = ['name', 'address', 'hours', 'phone', 'mapUrl', 'active', 'pickupEnabled', 'sort'];
  if (!Object.keys(body).length || Object.keys(body).some((key) => !allowed.includes(key))) throw new HttpError(400, 'validation', 'حقول الفرع غير صحيحة.');
  const current = { name: '', address: '', hours: '', phone: '', mapUrl: '', active: true, pickupEnabled: true, sort: 0 };
  const data: typeof current = { ...current };
  for (const key of ['name', 'address', 'hours', 'phone', 'mapUrl'] as const) {
    if (!(key in body)) {
      if (creating && key === 'name') throw new HttpError(400, 'validation', 'اسم الفرع مطلوب.');
      continue;
    }
    const value = body[key];
    const max = key === 'address' ? 300 : key === 'hours' ? 160 : key === 'mapUrl' ? 1000 : 100;
    if (typeof value !== 'string' || value.trim().length > max || (key === 'name' && value.trim().length < 2)) {
      throw new HttpError(400, 'validation', `قيمة ${key} غير صحيحة.`);
    }
    data[key] = value.trim();
  }
  if (data.mapUrl && !isSafeProductImageUrl(data.mapUrl)) throw new HttpError(400, 'validation', 'رابط الخريطة يجب أن يكون محليًا أو HTTPS.');
  for (const key of ['active', 'pickupEnabled'] as const) {
    if (!(key in body)) continue;
    if (typeof body[key] !== 'boolean') throw new HttpError(400, 'validation', 'حالة الفرع غير صحيحة.');
    data[key] = body[key] as boolean;
  }
  if ('sort' in body) {
    if (typeof body.sort !== 'number' || !Number.isInteger(body.sort) || body.sort < 0 || body.sort > 100_000) throw new HttpError(400, 'validation', 'ترتيب الفرع غير صحيح.');
    data.sort = body.sort;
  }
  if (creating) return data;
  return Object.fromEntries(Object.keys(body).map((key) => [key, data[key as keyof typeof data]])) as Partial<BranchData>;
}
