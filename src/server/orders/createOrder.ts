import { createHash } from 'node:crypto';
import { HttpError } from '../http';
import { quote, type Catalog, type CatalogCoupon } from '../pricing/quote';
import type { CheckoutInput } from '../validate';
import { paymentSelectable, type MethodConfig } from './rules';

export interface DbVariant { id: string; size: string; color: string; priceOverride: number | null; stock: number }
export interface DbProduct { id: string; legacyId: string | null; name: string; categoryId: string; price: number; salePrice: number | null; active: boolean; variants: DbVariant[] }
export interface PricingConfig { tiers: { min: number; rate: number }[]; coupons: CatalogCoupon[]; shippingFee: number | null; freeShippingMin: number | null }
export interface NewOrderItem { productId: string; variantId: string; name: string; categoryId: string; size: string; color: string; qty: number; unitOriginal: number; unitSale: number; lineOriginal: number; lineSale: number }
export interface NewOrder {
  userId: string | null; customerName: string; customerPhone: string; deliveryMethod: 'DELIVERY' | 'PICKUP'; deliveryCity: string | null; deliveryAddress: string | null;
  branchId: string | null; notes: string; paymentMethod: string; couponCode: string | null; subtotalOriginal: number; productDiscounts: number;
  tierRatePct: number; tierDiscount: number; couponDiscount: number; shippingFee: number; total: number; requestFingerprint: string; items: NewOrderItem[];
}
export interface OrderRequestIdentity {
  customerName: string; customerPhone: string; deliveryMethod: 'DELIVERY' | 'PICKUP'; deliveryCity: string | null; deliveryAddress: string | null;
  branchId: string | null; notes: string; paymentMethod: string; couponCode: string | null;
  items: { productId: string; size: string; color: string; qty: number }[];
}
export function orderRequestFingerprint(request: OrderRequestIdentity): string {
  const mergedItems = new Map<string, { productId: string; size: string; color: string; qty: number }>();
  for (const item of request.items) {
    const key = JSON.stringify([item.productId, item.size, item.color]);
    const existing = mergedItems.get(key);
    mergedItems.set(key, { ...item, qty: (existing?.qty ?? 0) + item.qty });
  }
  const items = [...mergedItems.values()]
    .map((item) => JSON.stringify([item.productId, item.size, item.color, item.qty]))
    .sort();
  return createHash('sha256').update(JSON.stringify([
    request.customerName, request.customerPhone, request.deliveryMethod, request.deliveryCity, request.deliveryAddress,
    request.branchId, request.notes, request.paymentMethod, request.couponCode, items,
  ])).digest('hex');
}
/** All DB access for order creation. Runs inside ONE transaction (see prismaOrderRunner). */
export interface OrderTx {
  findProducts(refs: string[]): Promise<DbProduct[]>;
  pricingConfig(): Promise<PricingConfig>;
  paymentConfig(code: string): Promise<MethodConfig | null>;
  branchActive(id: string): Promise<boolean>;
  reserveStock(variantId: string, qty: number): Promise<boolean>; // conditional decrement: false if not enough stock
  consumeCoupon(code: string): Promise<boolean>;                  // conditional increment: false if exhausted
  lockDuplicateRequest(fingerprint: string): Promise<void>;
  findRecentDuplicate(userId: string | null, phone: string, method: string, since: Date, fingerprint: string): Promise<{ id: string; number: number; total: number } | null>;
  insertOrder(o: NewOrder): Promise<{ id: string; number: number }>;
}
export interface OrderRunner { run<T>(fn: (tx: OrderTx) => Promise<T>): Promise<T> }

export interface QuoteItems { productId: string; qty: number; size: string | null; color: string | null }

/** Resolve refs (db id or legacyId), merge duplicate lines, and price on the server. Used by both /cart/quote and order creation. */
export async function buildQuote(tx: Pick<OrderTx, 'findProducts' | 'pricingConfig'>, items: QuoteItems[], couponCode: string, deliveryMethod: 'DELIVERY' | 'PICKUP', now = new Date()) {
  const found = await tx.findProducts([...new Set(items.map((i) => i.productId))]);
  const byRef = new Map<string, DbProduct>();
  for (const p of found) { byRef.set(p.id, p); if (p.legacyId) byRef.set(p.legacyId, p); }
  const unknown = items.filter((i) => !byRef.get(i.productId)?.active);
  if (unknown.length) throw new HttpError(422, 'product_unavailable', 'بعض المنتجات لم تعد متاحة.', unknown.map((u) => u.productId));
  // Re-merge after resolving legacy ids so one variant cannot be split across two refs to bypass the stock check.
  const merged = new Map<string, QuoteItems>();
  for (const i of items) {
    const id = byRef.get(i.productId)!.id, k = [id, i.size ?? '', i.color ?? ''].join('|'), ex = merged.get(k);
    merged.set(k, { productId: id, size: i.size, color: i.color, qty: (ex?.qty ?? 0) + i.qty });
  }
  const cfg = await tx.pricingConfig();
  const catalog: Catalog = {
    products: found.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, category: p.categoryId, price: p.price, salePrice: p.salePrice, variants: p.variants.map((v) => ({ size: v.size, color: v.color, stock: v.stock, price: v.priceOverride })) })),
    tiers: cfg.tiers, coupons: cfg.coupons, shippingFee: cfg.shippingFee, freeShippingMin: cfg.freeShippingMin,
  };
  const q = quote(catalog, { items: [...merged.values()], couponCode, deliveryMethod: deliveryMethod === 'DELIVERY' ? 'delivery' : 'pickup' }, now);
  return { q, byRef };
}

export async function createOrder(runner: OrderRunner, input: CheckoutInput, userId: string | null, now = new Date()) {
  return runner.run(async (tx) => {
    const { q, byRef } = await buildQuote(tx, input.items, input.couponCode, input.deliveryMethod, now);
    const fingerprint = orderRequestFingerprint({
      customerName: input.customerName, customerPhone: input.customerPhone, deliveryMethod: input.deliveryMethod,
      deliveryCity: input.deliveryMethod === 'DELIVERY' ? input.city : null,
      deliveryAddress: input.deliveryMethod === 'DELIVERY' ? input.address : null,
      branchId: input.deliveryMethod === 'PICKUP' ? input.branchId : null,
      notes: input.notes, paymentMethod: input.paymentMethod, couponCode: input.couponCode || null,
      items: input.items.map((item) => ({
        productId: byRef.get(item.productId)?.id ?? item.productId, size: item.size ?? '', color: item.color ?? '', qty: item.qty,
      })),
    });
    // Serialize identical requests in PostgreSQL, then return the prior result rather than reserving stock twice.
    await tx.lockDuplicateRequest(fingerprint);
    const dup = await tx.findRecentDuplicate(userId, input.customerPhone, input.paymentMethod, new Date(now.getTime() - 60_000), fingerprint);
    if (dup) return { ...dup, duplicate: true as const };
    if (!q.ok) throw new HttpError(409, 'cart_invalid', 'تعذّر إتمام الطلب، راجع السلة.', q.errors.map((e) => e.message));
    if (input.couponCode && q.couponError) throw new HttpError(422, 'coupon_invalid', q.couponError);
    if (!paymentSelectable(input.paymentMethod, await tx.paymentConfig(input.paymentMethod))) throw new HttpError(422, 'payment_unavailable', 'وسيلة الدفع المختارة غير متاحة حاليًا.');
    if (input.deliveryMethod === 'PICKUP' && !(input.branchId && (await tx.branchActive(input.branchId)))) throw new HttpError(422, 'branch_invalid', 'فرع الاستلام غير متاح.');

    const items: NewOrderItem[] = q.lines.map((l) => {
      const p = byRef.get(l.productId)!, v = p.variants.find((x) => x.size === (l.size ?? '') && x.color === (l.color ?? ''))!;
      return { productId: p.id, variantId: v.id, name: l.name, categoryId: l.category, size: l.size ?? '', color: l.color ?? '', qty: l.qty, unitOriginal: l.unitOriginal, unitSale: l.unitSale, lineOriginal: l.lineOriginal, lineSale: l.lineSale };
    });
    for (const it of items) if (!(await tx.reserveStock(it.variantId, it.qty))) throw new HttpError(409, 'out_of_stock', `المتاح من «${it.name}» لم يعد كافيًا.`); // throws -> whole tx rolls back
    if (q.coupon && !(await tx.consumeCoupon(q.coupon.code))) throw new HttpError(409, 'coupon_exhausted', 'تم استنفاد هذا الكود.');

    const created = await tx.insertOrder({
      userId, customerName: input.customerName, customerPhone: input.customerPhone, deliveryMethod: input.deliveryMethod,
      deliveryCity: input.deliveryMethod === 'DELIVERY' ? input.city : null, deliveryAddress: input.deliveryMethod === 'DELIVERY' ? input.address : null,
      branchId: input.deliveryMethod === 'PICKUP' ? input.branchId : null, notes: input.notes, paymentMethod: input.paymentMethod,
      couponCode: q.coupon?.code ?? null, requestFingerprint: fingerprint,
      subtotalOriginal: q.subtotalOriginal, productDiscounts: q.productDiscounts, tierRatePct: q.tierRate,
      tierDiscount: q.tierDiscount, couponDiscount: q.couponDiscount, shippingFee: q.shippingFee, total: q.total, items,
    });
    return { ...created, duplicate: false as const, total: q.total };
  });
}
