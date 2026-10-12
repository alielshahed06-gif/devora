/** Pure, framework-free cart logic. Same persisted shape/key as the original UI (`dx_cart`: [{productId,size,color,qty}]). */
export const CART_KEY = 'dx_cart';
export interface CartItem { productId: string; size: string | null; color: string | null; qty: number }
export interface StockLookup { (productId: string, size: string | null, color: string | null): number | null } // null = unknown variant

export const cartKey = (i: Pick<CartItem, 'productId' | 'size' | 'color'>) => [i.productId, i.size || '', i.color || ''].join('|');
export const cartCount = (c: CartItem[]) => c.reduce((s, i) => s + i.qty, 0);

export type CartResult = { cart: CartItem[]; error?: string };

export function addItem(cart: CartItem[], item: CartItem, stock: StockLookup): CartResult {
  const max = stock(item.productId, item.size, item.color);
  if (max == null) return { cart, error: 'الاختيار المحدد غير متاح.' };
  if (!Number.isInteger(item.qty) || item.qty < 1) return { cart, error: 'كمية غير صحيحة.' };
  const key = cartKey(item), ex = cart.find((i) => cartKey(i) === key);
  const have = ex?.qty ?? 0;
  if (have + item.qty > max) return { cart, error: `المتاح ${max} فقط (لديك ${have} في السلة).` };
  return { cart: ex ? cart.map((i) => (cartKey(i) === key ? { ...i, qty: i.qty + item.qty } : i)) : [...cart, { ...item }] };
}

/** Change quantity by delta, clamped to [1, stock] (like the original: never drops below 1; remove is explicit). */
export function changeQty(cart: CartItem[], key: string, delta: number, stock: StockLookup): CartResult {
  const it = cart.find((i) => cartKey(i) === key); if (!it) return { cart };
  const max = stock(it.productId, it.size, it.color);
  const next = Math.max(1, it.qty + delta);
  if (max != null && next > max) return { cart, error: `المتاح ${max} فقط.` };
  return { cart: cart.map((i) => (cartKey(i) === key ? { ...i, qty: next } : i)) };
}
export const removeItem = (cart: CartItem[], key: string): CartItem[] => cart.filter((i) => cartKey(i) !== key);

/** Defensive parse of localStorage content: drops malformed entries, merges duplicates. Never throws. */
export function parseStoredCart(raw: string | null): CartItem[] {
  let v: unknown; try { v = raw ? JSON.parse(raw) : []; } catch { return []; }
  if (!Array.isArray(v)) return [];
  const out = new Map<string, CartItem>();
  for (const e of v) {
    if (!e || typeof e !== 'object') continue;
    const o = e as Record<string, unknown>;
    const qty = Math.floor(Number(o.qty));
    if (typeof o.productId !== 'string' || !(qty > 0) || qty > 999) continue;
    const it: CartItem = { productId: o.productId, size: typeof o.size === 'string' && o.size ? o.size : null, color: typeof o.color === 'string' && o.color ? o.color : null, qty };
    const k = cartKey(it), ex = out.get(k); out.set(k, ex ? { ...ex, qty: Math.min(999, ex.qty + qty) } : it);
  }
  return [...out.values()];
}
