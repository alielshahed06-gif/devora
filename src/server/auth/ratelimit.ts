/** Fixed-window limiter. IN-MEMORY: per server instance only. For multi-instance production, back it with a shared store (Redis/Upstash). */
export function createLimiter(opts: { windowMs: number; max: number }) {
  const hits = new Map<string, { n: number; reset: number }>();
  return {
    check(key: string, now = Date.now()): { ok: boolean; retryAfterS: number } {
      if (hits.size > 5000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
      const h = hits.get(key);
      if (!h || h.reset <= now) { hits.set(key, { n: 1, reset: now + opts.windowMs }); return { ok: true, retryAfterS: 0 }; }
      h.n++;
      return h.n > opts.max ? { ok: false, retryAfterS: Math.ceil((h.reset - now) / 1000) } : { ok: true, retryAfterS: 0 };
    },
  };
}
