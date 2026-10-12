'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { cartKey } from '../lib/cart';
import { quoteCart } from '../lib/storefront';
import { formatPriceAr } from '../lib/money';
import { api } from '../lib/api';
import { useCart } from './CartProvider';
import { Empty } from './ProductCard';
import { Icon } from './Icon';

interface Quote {
  ok: boolean;
  errors: { message: string }[];
  subtotalOriginal: number;
  productDiscounts: number;
  tierRate: number;
  tierDiscount: number;
  shippingFee: number;
  freeShipping: boolean;
  total: number;
  lines: { productId: string; name: string; size: string | null; color: string | null; unitOriginal: number; unitSale: number; lineSale: number }[];
}
interface CartLine { cartProductId: string; productId: string; name: string; size: string | null; color: string | null; qty: number; unitOriginal: number; unitSale: number; lineSale: number; stock: number }

export function CartView({ demoMode = false }: { demoMode?: boolean }) {
  const { cart, loaded, change, remove, setStock } = useCart();
  const preview = useMemo(() => demoMode ? quoteCart(cart) : null, [cart, demoMode]);
  const queryItems = useMemo(() => cart.map(({ productId, size, color, qty }) => ({ productId, size, color, qty })), [cart]);
  const queryKey = JSON.stringify(queryItems);
  const [quoteState, setQuoteState] = useState<{ key: string; data?: { quote: Quote; items: CartLine[] }; error?: string }>({ key: '' });
  useEffect(() => {
    if (demoMode || !loaded || !queryItems.length) return;
    let active = true;
    void api<{ quote: Quote; items: CartLine[] }>('/api/v1/cart/quote', {
      method: 'POST',
      body: { items: queryItems, deliveryMethod: 'DELIVERY' },
    }).then((result) => {
      if (!active) return;
      setQuoteState(result.ok ? { key: queryKey, data: result.data } : { key: queryKey, error: result.message });
      if (result.ok) setStock(result.data.items);
    });
    return () => { active = false; };
  }, [demoMode, loaded, queryItems, queryKey, setStock]);
  const hasCurrentQuote = quoteState.key === queryKey;
  const liveQuote = hasCurrentQuote ? quoteState.data ?? null : null;
  const quoteError = hasCurrentQuote ? quoteState.error ?? '' : '';
  const loadingQuote = !demoMode && loaded && cart.length > 0 && !hasCurrentQuote;
  const q = demoMode ? preview : liveQuote?.quote ?? null;
  const lines: CartLine[] = demoMode
    ? (preview?.lines ?? []).map((line) => ({ ...line, cartProductId: line.productId, qty: line.qty, stock: 0 }))
    : liveQuote?.items ?? [];
  if (!loaded) return <div className="spin" role="status">جاري التحميل…</div>;
  if (!cart.length) return <Empty title="سلتك فارغة" text="أضف منتجات لتظهر هنا." href="/categories" action="تصفّح الأقسام" />;
  return (
    <>
      {demoMode && <div className="msg warn" role="status">هذه أسعار تجريبية من بيانات العرض، وليست عرض سعر من قاعدة البيانات.</div>}
      {quoteError && <div className="msg err" role="alert"><Icon name="x" /> {quoteError}</div>}
      {loadingQuote && <div className="spin" role="status">جاري التحقق من الأسعار والمخزون…</div>}
      {q?.errors.map((e, i) => <div key={i} className="msg err" role="alert"><Icon name="x" /> {e.message}</div>)}
      <div className="layout2">
        <div className="card">
          {cart.map((i) => {
            const k = cartKey(i), l = lines.find((x) => x.cartProductId === i.productId && (x.size ?? '') === (i.size ?? '') && (x.color ?? '') === (i.color ?? ''));
            return l ? (
              <div className="line" key={k}>
                <div className="t"><Link href={`/product/${l.productId}`}><b>{l.name}</b></Link><span className="muted">{[l.size, l.color].filter(Boolean).join(' · ')}</span>
                  <div><span className={`price${l.unitSale < l.unitOriginal ? ' sale' : ''}`}>{formatPriceAr(l.unitSale)}</span>{l.unitSale < l.unitOriginal && <span className="old">{formatPriceAr(l.unitOriginal)}</span>}</div></div>
                  <div className="qty"><button type="button" aria-label="إنقاص" onClick={() => change(k, -1)}>−</button><span>{i.qty}</span><button type="button" aria-label="زيادة" disabled={!demoMode && i.qty >= l.stock} onClick={() => change(k, 1)}>+</button></div>
                <b>{formatPriceAr(l.lineSale)}</b>
                <button type="button" className="btn secondary sm" aria-label="حذف" onClick={() => remove(k)}>حذف</button>
              </div>
            ) : <div className="line" key={k}><div className="t">{quoteError ? <div className="msg err"><Icon name="x" /> تعذّر التحقق من المنتج</div> : <div className="muted">{loadingQuote ? 'جاري تحميل بيانات المنتج…' : 'المنتج غير متاح في قاعدة البيانات'}</div>}</div><div className="qty"><button type="button" aria-label="إنقاص" onClick={() => change(k, -1)}>−</button><span>{i.qty}</span><button type="button" aria-label="زيادة" disabled={!demoMode} onClick={() => change(k, 1)}>+</button></div><button type="button" className="btn secondary sm" aria-label="حذف" onClick={() => remove(k)}>حذف</button></div>;
          })}
        </div>
        <div>
          <div className="summary"><h3>ملخص الطلب</h3>{q && <dl>
            <div className="l"><span>إجمالي المنتجات قبل الخصومات</span><span>{formatPriceAr(q.subtotalOriginal)}</span></div>
            {q.productDiscounts > 0 && <div className="l save"><span>خصومات المنتجات</span><span>− {formatPriceAr(q.productDiscounts)}</span></div>}
            {q.tierDiscount > 0 && <div className="l save"><span>خصم إجمالي الطلب ({q.tierRate}٪)</span><span>− {formatPriceAr(q.tierDiscount)}</span></div>}
            <div className="l"><span>الشحن التقديري</span><span>{q.freeShipping ? 'مجاني' : formatPriceAr(q.shippingFee)}</span></div>
            <div className="l total"><span>الإجمالي التقديري</span><span>{formatPriceAr(q.total)}</span></div></dl>}
            <small>خصم الشريحة يُحسب على الإجمالي بعد خصومات المنتجات. الشحن وكود الخصم يُراجعان عند إتمام الطلب.</small></div>
          <p>{demoMode || quoteError || loadingQuote || !q?.ok ? <button className="btn" disabled style={{ width: '100%' }}>إتمام الطلب غير متاح</button> : <Link className="btn" href="/checkout" style={{ width: '100%' }}>إتمام الطلب</Link>}</p>
          <div className="msg warn" role="status"><Icon name="alert" /> السلة محفوظة على جهازك. {demoMode ? 'إتمام الطلب معطّل في وضع العرض التجريبي.' : 'الأسعار والمخزون النهائيان يتحقق منهما الخادم؛ يلزم تسجيل الدخول.'}</div>
        </div>
      </div>
    </>
  );
}
