/** Browser-side fetch wrapper for the /api/v1 endpoints. Never sends prices/totals; the server computes them. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string; details?: unknown };

export async function api<T = Record<string, unknown>>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: opts.method ?? 'GET', credentials: 'same-origin',
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const j = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: { message?: string; details?: unknown } } & T) | null;
    if (res.ok && j?.ok) return { ok: true, data: j as T };
    return { ok: false, status: res.status, message: j?.error?.message ?? 'تعذّر الاتصال بالخادم.', details: j?.error?.details };
  } catch {
    return { ok: false, status: 0, message: 'تعذّر الاتصال بالخادم.' };
  }
}

/** Only same-site relative paths are allowed as post-login redirects (prevents open redirects). */
export const safeNext = (n: string | null | undefined): string => (n && /^\/(?!\/)[\w\-./?=&%]*$/.test(n) ? n : '/account');
