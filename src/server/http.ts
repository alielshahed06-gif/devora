/** Framework-light HTTP helpers (standard Request/Response only, so they are unit-testable). */
export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}
export const ok = (data: Record<string, unknown> = {}, init: ResponseInit = {}) =>
  Response.json({ ok: true, ...data }, { ...init, headers: { 'Cache-Control': 'no-store', ...(init.headers as Record<string, string> | undefined) } });

export function fail(e: unknown): Response {
  if (e instanceof HttpError) {
    const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
    if (e.status === 429 && typeof e.details === 'number') headers['Retry-After'] = String(e.details);
    return Response.json({ ok: false, error: { code: e.code, message: e.message, ...(e.status === 429 || e.details === undefined ? {} : { details: e.details }) } }, { status: e.status, headers });
  }
  console.error('Unhandled API error:', e instanceof Error ? e.name : 'unknown');
  return Response.json({ ok: false, error: { code: 'internal', message: 'حدث خطأ غير متوقع.' } }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
}

/** Wrap a handler so thrown HttpErrors become proper responses. */
export const handle = <A extends unknown[]>(fn: (...a: A) => Promise<Response>) => async (...a: A): Promise<Response> => { try { return await fn(...a); } catch (e) { return fail(e); } };

export async function readJson(req: Request, maxBytes = 64_000): Promise<unknown> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > maxBytes) throw new HttpError(413, 'too_large', 'الطلب كبير جدًا.');
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'too_large', 'الطلب كبير جدًا.');
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'bad_json', 'صيغة البيانات غير صحيحة.'); }
}

/** CSRF defence in depth (cookies are also SameSite=Lax): reject cross-origin browser writes. */
export function assertSameOrigin(req: Request): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  const origin = req.headers.get('origin');
  if (!origin) return; // non-browser client; cookies would not be attached cross-site anyway (SameSite=Lax)
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  let o: URL; try { o = new URL(origin); } catch { throw new HttpError(403, 'bad_origin', 'مصدر الطلب غير مسموح.'); }
  if (!host || o.host !== host) throw new HttpError(403, 'bad_origin', 'مصدر الطلب غير مسموح.');
}

export const clientIp = (req: Request): string => (req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown').trim();
