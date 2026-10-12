'use client';
import { createContext, useCallback, useContext, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { CART_KEY, addItem, cartCount, cartKey, changeQty, parseStoredCart, removeItem, type CartItem } from '../lib/cart';
import { stockOf } from '../lib/storefront';
import { Icon } from './Icon';

interface StockItem { productId: string; size: string | null; color: string | null; stock: number }
interface Ctx { cart: CartItem[]; loaded: boolean; count: number; add: (i: CartItem, stock?: number) => boolean; setStock: (items: StockItem[]) => void; change: (key: string, d: number) => void; remove: (key: string) => void; clear: () => void; toast: (m: string, t?: 'ok' | 'err') => void }
const CartCtx = createContext<Ctx | null>(null);
export const useCart = (): Ctx => { const c = useContext(CartCtx); if (!c) throw new Error('useCart outside CartProvider'); return c; };

const EMPTY_CART = '[]';
let memoryCart = EMPTY_CART;
const subscribeCart = (onChange: () => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== CART_KEY) return;
    memoryCart = event.newValue ?? EMPTY_CART;
    onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener('dx-cart-change', onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('dx-cart-change', onChange);
  };
};
const getCartSnapshot = () => {
  try {
    const stored = localStorage.getItem(CART_KEY);
    if (stored !== null) memoryCart = stored;
  } catch {
    return memoryCart;
  }
  return memoryCart;
};

export function CartProvider({ children }: { children: ReactNode }) {
  const rawCart = useSyncExternalStore(subscribeCart, getCartSnapshot, () => EMPTY_CART);
  const loaded = useSyncExternalStore(() => () => {}, () => true, () => false);
  const cart = useMemo(() => parseStoredCart(rawCart), [rawCart]);
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stockLimits = useRef(new Map<string, number>());

  const toast = useCallback((text: string, type: 'ok' | 'err' = 'ok') => { setMsg({ text, type }); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(null), 3500); }, []);
  const persist = useCallback((next: CartItem[]) => {
    memoryCart = JSON.stringify(next);
    try { localStorage.setItem(CART_KEY, memoryCart); }
    catch { toast('تعذّر حفظ السلة على هذا الجهاز؛ ستظل متاحة خلال الجلسة الحالية.', 'err'); }
    window.dispatchEvent(new Event('dx-cart-change'));
  }, [toast]);

  const value = useMemo<Ctx>(() => ({
    cart, loaded, count: cartCount(cart), toast,
    add: (i, stock) => {
      if (stock != null) stockLimits.current.set(cartKey(i), stock);
      const lookup = (productId: string, size: string | null, color: string | null) =>
        stockLimits.current.get(cartKey({ productId, size, color })) ?? stockOf(productId, size, color);
      const r = addItem(cart, i, lookup);
      if (r.error) { toast(r.error, 'err'); return false; }
      persist(r.cart); toast('أُضيف إلى السلة.'); return true;
    },
    setStock: (items) => { for (const item of items) stockLimits.current.set(cartKey(item), item.stock); },
    change: (key, d) => {
      const lookup = (productId: string, size: string | null, color: string | null) =>
        stockLimits.current.get(cartKey({ productId, size, color })) ?? stockOf(productId, size, color);
      const r = changeQty(cart, key, d, lookup);
      if (r.error) toast(r.error, 'err'); else persist(r.cart);
    },
    remove: (key) => persist(removeItem(cart, key)),
    clear: () => persist([]),
  }), [cart, loaded, persist, toast]);

  return (
    <CartCtx.Provider value={value}>
      {children}
      <div id="toast" className={`toast ${msg?.type ?? 'ok'}`} role="status" aria-live="polite" hidden={!msg}>{msg && <><Icon name={msg.type === 'ok' ? 'check' : 'x'} /> {msg.text}</>}</div>
    </CartCtx.Provider>
  );
}
