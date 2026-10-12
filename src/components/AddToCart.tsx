'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { discountPct, isAvailable, type Product } from '../lib/catalog';
import { formatPriceAr } from '../lib/money';
import { useCart } from './CartProvider';
import { Icon } from './Icon';

const Msg = ({ type, children }: { type: 'ok' | 'err' | 'info'; children: ReactNode }) => <div className={`msg ${type}`} role={type === 'err' ? 'alert' : 'status'}><Icon name={type === 'ok' ? 'check' : type === 'err' ? 'x' : 'info'} /> {children}</div>;

/** Variant picker + quantity + add-to-cart. Behaviour mirrors the original product page. */
export function AddToCart({ product: p, children }: { product: Product; children?: ReactNode }) {
  const { add } = useCart();
  const sizes = useMemo(() => [...new Set(p.variants.map((v) => v.size).filter((x): x is string => !!x))], [p]);
  const colors = useMemo(() => [...new Set(p.variants.map((v) => v.color).filter((x): x is string => !!x))], [p]);
  const [size, setSize] = useState<string | null>(sizes.length === 1 ? sizes[0] : null);
  const [color, setColor] = useState<string | null>(colors.length === 1 ? colors[0] : null);
  const [qty, setQty] = useState(1);
  const v = p.variants.find((x) => (x.size ?? null) === (size ?? null) && (x.color ?? null) === (color ?? null));
  const need = (sizes.length > 0 && !size) || (colors.length > 0 && !color);
  const hasSale = v ? v.price == null && p.salePrice != null : p.salePrice != null;
  const price = v ? v.price ?? p.salePrice ?? p.price : p.salePrice ?? p.price;
  const stock = v ? v.stock : null;
  const missing = [sizes.length && !size ? 'المقاس' : '', colors.length && !color ? 'اللون' : ''].filter(Boolean).join(' و');
  const pickSize = (s: string) => { const next = size === s ? null : s; setSize(next); if (color && !p.variants.some((x) => x.size === next && x.color === color && x.stock > 0)) setColor(null); setQty(1); };

  return (
    <>
      <p><span className={`price${hasSale ? ' sale' : ''}`} style={{ fontSize: '1.4rem' }}>{formatPriceAr(price)}</span>{hasSale && <><span className="old">{formatPriceAr(p.price)}</span> <span className="badge off">خصم {discountPct(p)}٪</span></>}</p>
      {children}
      {sizes.length > 0 && <><label>المقاس</label><div className="chips">{sizes.map((s) => <button key={s} type="button" className="chip-btn" aria-pressed={size === s} disabled={!p.variants.some((x) => x.size === s && (!color || x.color === color) && x.stock > 0)} onClick={() => pickSize(s)}>{s}</button>)}</div></>}
      {colors.length > 0 && <><label>اللون</label><div className="chips">{colors.map((c) => <button key={c} type="button" className="chip-btn" aria-pressed={color === c} disabled={!p.variants.some((x) => x.color === c && (!size || x.size === size) && x.stock > 0)} onClick={() => { setColor(color === c ? null : c); setQty(1); }}>{c}</button>)}</div></>}
      <div style={{ marginTop: '.8rem' }}>
        {!isAvailable(p) ? <Msg type="err">هذا المنتج غير متاح حاليًا.</Msg> : need ? <Msg type="info">اختر {missing} لمعرفة التوافر.</Msg> : stock != null && stock > 0 ? <Msg type="ok">{stock <= 5 ? `متاح — بقي ${stock} فقط.` : 'متاح.'}</Msg> : <Msg type="err">هذا الاختيار غير متاح حاليًا.</Msg>}
      </div>
      <label>الكمية</label>
      <div className="qty"><button type="button" aria-label="إنقاص" onClick={() => setQty(Math.max(1, qty - 1))}>−</button><span>{qty}</span><button type="button" aria-label="زيادة" onClick={() => { if (stock != null && qty >= stock) return; setQty(qty + 1); }}>+</button></div>
      <p><button type="button" className="btn" style={{ width: '100%' }} disabled={!(stock != null && stock > 0 && !need)} onClick={() => add({ productId: p.id, size, color, qty }, stock ?? undefined)}>أضف إلى السلة</button></p>
    </>
  );
}
