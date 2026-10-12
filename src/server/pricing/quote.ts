/**
 * Pricing engine — TypeScript port of `quote()` from reference/original-ui/dev-x-book-store-8-2.html,
 * converted to integer piasters. Order of operations (must stay identical):
 *   product prices -> product sale prices -> tier discount (on total after product discounts)
 *   -> coupon (on eligible lines after tier discount) -> shipping.
 * Parity with the original is asserted in tests/quote.parity.test.ts.
 * Pure function: no DB, no clock (pass `now`). The caller loads the catalog inside a transaction.
 */
import { pct, type Piasters } from '../../lib/money';

export interface CatalogVariant { size?: string | null; color?: string | null; stock: number; price?: Piasters | null }
export interface CatalogProduct { id: string; name: string; category: string; price: Piasters; salePrice: Piasters | null; variants: CatalogVariant[] }
export interface CatalogCoupon {
  code: string; label: string; type: 'percent' | 'fixed'; value: number; minOrder: Piasters; active: boolean;
  startsAt?: string | null; expiresAt?: string | null; maxUses?: number | null; uses: number; categories: string[]; productIds: string[];
}
export interface Catalog {
  products: CatalogProduct[]; tiers: { min: Piasters; rate: number }[]; coupons: CatalogCoupon[];
  shippingFee: Piasters | null; freeShippingMin: Piasters | null;
}
export interface QuoteInput { items: { productId: string; qty: number; size?: string | null; color?: string | null }[]; couponCode?: string; deliveryMethod?: 'delivery' | 'pickup' }
export interface QuoteLine {
  productId: string; name: string; category: string; size: string | null; color: string | null; qty: number;
  unitOriginal: Piasters; unitSale: Piasters; lineOriginal: Piasters; lineSale: Piasters;
}
export interface QuoteError { productId: string; size?: string | null; color?: string | null; message: string }
export interface Quote {
  ok: boolean; errors: QuoteError[]; lines: QuoteLine[]; subtotalOriginal: Piasters; productDiscounts: Piasters; afterProduct: Piasters;
  tierRate: number; tierDiscount: Piasters; coupon: { code: string; label: string } | null; couponDiscount: Piasters; couponError: string | null;
  shippingFee: Piasters; freeShipping: boolean; total: Piasters;
}

const same = (a: string | null | undefined, b: string | null | undefined) => (a || null) === (b || null);
export const findVariant = (p: CatalogProduct, size?: string | null, color?: string | null) => p.variants.find((v) => same(v.size, size) && same(v.color, color));

export function quote(cat: Catalog, input: QuoteInput, now: Date = new Date()): Quote {
  const errors: QuoteError[] = [];
  const lines: QuoteLine[] = [];
  for (const it of Array.isArray(input.items) ? input.items : []) {
    const p = cat.products.find((x) => x.id === it.productId);
    const qty = Math.floor(Number(it.qty));
    if (!p || !(qty > 0)) { errors.push({ productId: it.productId, message: 'منتج غير موجود أو كمية غير صحيحة.' }); continue; }
    const v = findVariant(p, it.size, it.color);
    if (!v) { errors.push({ productId: p.id, message: `الاختيار المحدد غير متاح للمنتج «${p.name}».` }); continue; }
    if (v.stock <= 0) errors.push({ productId: p.id, size: it.size, color: it.color, message: `«${p.name}» غير متاح حاليًا.` });
    else if (qty > v.stock) errors.push({ productId: p.id, size: it.size, color: it.color, message: `المتاح من «${p.name}» ${v.stock} فقط.` });
    const unitOriginal = v.price ?? p.price;
    const unitSale = v.price == null && p.salePrice != null ? p.salePrice : unitOriginal;
    lines.push({ productId: p.id, name: p.name, category: p.category, size: it.size || null, color: it.color || null, qty, unitOriginal, unitSale, lineOriginal: unitOriginal * qty, lineSale: unitSale * qty });
  }
  const subtotalOriginal = lines.reduce((s, l) => s + l.lineOriginal, 0);
  const afterProduct = lines.reduce((s, l) => s + l.lineSale, 0);
  const productDiscounts = subtotalOriginal - afterProduct;

  const tier = [...cat.tiers].sort((a, b) => b.min - a.min).find((t) => afterProduct >= t.min);
  const tierRate = tier ? tier.rate : 0;
  const tierDiscount = pct(afterProduct, tierRate);

  let coupon: Quote['coupon'] = null, couponDiscount = 0, couponError: string | null = null;
  const code = String(input.couponCode || '').trim().toUpperCase();
  if (code) {
    const c = cat.coupons.find((x) => x.code === code);
    const after = afterProduct - tierDiscount;
    const eligible = c ? lines.filter((l) => (!c.categories?.length || c.categories.includes(l.category)) && (!c.productIds?.length || c.productIds.includes(l.productId))) : [];
    const expired = c?.expiresAt ? now > new Date(c.expiresAt + (c.expiresAt.length === 10 ? 'T23:59:59' : '')) : false;
    if (!c || !c.active) couponError = 'كود الخصم غير صحيح.';
    else if (c.startsAt && now < new Date(c.startsAt)) couponError = 'كود الخصم لم يبدأ بعد.';
    else if (expired) couponError = 'كود الخصم منتهي الصلاحية.';
    else if (c.maxUses != null && c.uses >= c.maxUses) couponError = 'تم استنفاد عدد مرات استخدام هذا الكود.';
    else if (afterProduct < (c.minOrder || 0)) couponError = `الحد الأدنى لتطبيق هذا الكود ${c.minOrder / 100} جنيه.`;
    else if (!eligible.length) couponError = 'هذا الكود لا ينطبق على المنتجات الموجودة في سلتك.';
    else {
      // original: round(sum(lineSale * (1 - tierRate/100))) — single rounding on the sum
      const base = Math.round((eligible.reduce((s, l) => s + l.lineSale, 0) * (100 - tierRate)) / 100);
      couponDiscount = c.type === 'percent' ? pct(base, c.value) : Math.min(c.value, base);
      couponDiscount = Math.min(couponDiscount, after);
      coupon = { code: c.code, label: c.label };
    }
  }
  const afterAll = afterProduct - tierDiscount - couponDiscount;
  const fsMin = cat.freeShippingMin;
  const freeShipping = input.deliveryMethod === 'delivery' && typeof fsMin === 'number' && fsMin > 0 && afterAll >= fsMin;
  const shippingFee = input.deliveryMethod === 'delivery' && typeof cat.shippingFee === 'number' && !freeShipping ? cat.shippingFee : 0;
  const total = Math.max(0, afterAll + shippingFee);
  return { ok: errors.length === 0 && lines.length > 0, errors, lines, subtotalOriginal, productDiscounts, afterProduct, tierRate, tierDiscount, coupon, couponDiscount, couponError, shippingFee, freeShipping, total };
}
