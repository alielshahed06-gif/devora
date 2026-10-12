import test from 'node:test'; import assert from 'node:assert/strict';
import { createOrder, type DbProduct, type NewOrder, type OrderRunner, type OrderTx, type PricingConfig } from '../src/server/orders/createOrder';
import { paymentSelectable, paymentStatusAfterTransition, transitionError } from '../src/server/orders/rules';
import { parseCheckout, parseQuote, parseProductCreate, parseProductPatch, parseProductQuery, parseProductVariants } from '../src/server/validate';
import { HttpError } from '../src/server/http';
import type { MethodConfig } from '../src/server/orders/rules';

interface State { products: DbProduct[]; pay: Record<string, MethodConfig>; orders: (NewOrder & { id: string; number: number; status: string; createdAt: Date })[]; couponUses: Record<string, number>; cfg: PricingConfig }
const baseState = (): State => ({
  products: [{ id: 'p1', legacyId: 't1', name: 'Shirt', categoryId: 'tshirts', price: 35000, salePrice: 30000, active: true, variants: [{ id: 'v1', size: 'M', color: '', priceOverride: null, stock: 3 }] },
             { id: 'p2', legacyId: null, name: 'Draft', categoryId: 'books', price: 10000, salePrice: null, active: false, variants: [{ id: 'v2', size: '', color: '', priceOverride: null, stock: 9 }] }],
  pay: { COD: { code: 'COD', enabled: true, status: 'READY' }, INSTAPAY: { code: 'INSTAPAY', enabled: true, status: 'NOT_CONFIGURED' }, FAWRY: { code: 'FAWRY', enabled: true, status: 'READY' } },
  orders: [], couponUses: {},
  cfg: { tiers: [{ min: 80000, rate: 10 }], coupons: [], shippingFee: 5000, freeShippingMin: null },
});
/** Transactional fake: state is cloned, and committed only if the callback resolves — mimics DB rollback. */
function runner(s: State): OrderRunner {
  return { async run(fn) {
    const w: State = structuredClone(s);
    const tx: OrderTx = {
      async findProducts(refs) { return w.products.filter((p) => refs.includes(p.id) || (p.legacyId && refs.includes(p.legacyId))); },
      async pricingConfig() { return w.cfg; },
      async paymentConfig(c) { return w.pay[c] ?? null; },
      async branchActive(id) { return id === 'b1'; },
      async reserveStock(vid, qty) { const v = w.products.flatMap((p) => p.variants).find((x) => x.id === vid)!; if (v.stock < qty) return false; v.stock -= qty; return true; },
      async consumeCoupon(code) { w.couponUses[code] = (w.couponUses[code] ?? 0) + 1; return true; },
      async lockDuplicateRequest() {},
      async findRecentDuplicate(uid, phone, method, since, fingerprint) {
        const o = w.orders.find((x) => x.userId === uid && x.customerPhone === phone && x.createdAt >= since && x.paymentMethod === method &&
          x.requestFingerprint === fingerprint && x.status !== 'CANCELLED');
        return o ? { id: o.id, number: o.number, total: o.total } : null;
      },
      async insertOrder(o) { const r = { ...o, id: `o${w.orders.length + 1}`, number: 1001 + w.orders.length, status: 'CONFIRMED', createdAt: new Date() }; w.orders.push(r); return { id: r.id, number: r.number }; },
    };
    const out = await fn(tx);
    Object.assign(s, w);
    return out;
  } };
}
const input = (over: Record<string, unknown> = {}) => parseCheckout({ items: [{ productId: 't1', qty: 2, size: 'M' }], deliveryMethod: 'DELIVERY', city: 'Cairo', address: '12 Tahrir St', customerName: 'Ali Ahmed', customerPhone: '+20 100 000 0001', paymentMethod: 'COD', ...over });
const code = async (p: Promise<unknown>) => { try { await p; return null; } catch (e) { return e instanceof HttpError ? e.code : 'other'; } };

test('creates order with server-side prices, resolves legacyId, decrements stock, never PAID', async () => {
  const s = baseState();
  const r = await createOrder(runner(s), input(), 'u1');
  assert.equal(r.duplicate, false);
  assert.equal(s.products[0].variants[0].stock, 1);
  const o = s.orders[0];
  assert.equal(o.items[0].productId, 'p1'); assert.equal(o.items[0].unitSale, 30000);
  assert.equal(o.subtotalOriginal, 70000); assert.equal(o.total, 60000 + 5000); // 2*300 EGP, no tier (<800), + shipping 50
  assert.equal(o.customerPhone, '01000000001');
  assert.ok(!('paymentStatus' in o) || (o as never as { paymentStatus: string }).paymentStatus === undefined); // store sets AWAITING_PAYMENT itself
});
test('oversell rolls back everything', async () => {
  const s = baseState();
  assert.equal(await code(createOrder(runner(s), input({ items: [{ productId: 't1', qty: 4, size: 'M' }] }), 'u1')), 'cart_invalid');
  assert.equal(s.orders.length, 0); assert.equal(s.products[0].variants[0].stock, 3);
});
test('stock split across legacy+db id cannot bypass the check', async () => {
  const s = baseState();
  const e = await code(createOrder(runner(s), input({ items: [{ productId: 't1', qty: 2, size: 'M' }, { productId: 'p1', qty: 2, size: 'M' }] }), 'u1'));
  assert.equal(e, 'cart_invalid'); assert.equal(s.products[0].variants[0].stock, 3);
});
test('inactive/unknown products are rejected', async () => {
  assert.equal(await code(createOrder(runner(baseState()), input({ items: [{ productId: 'p2', qty: 1 }] }), 'u1')), 'product_unavailable');
  assert.equal(await code(createOrder(runner(baseState()), input({ items: [{ productId: 'nope', qty: 1 }] }), 'u1')), 'product_unavailable');
});
test('online payments remain unavailable without a verified provider; COD stays unpaid until delivery', async () => {
  assert.equal(await code(createOrder(runner(baseState()), input({ paymentMethod: 'INSTAPAY' }), 'u1')), 'payment_unavailable');
  assert.equal(await code(createOrder(runner(baseState()), input({ paymentMethod: 'VODAFONE_CASH' }), 'u1')), 'payment_unavailable'); // no config row
  const s = baseState(); assert.equal(await code(createOrder(runner(s), input({ paymentMethod: 'FAWRY' }), 'u1')), 'payment_unavailable');
});
test('pickup needs a valid branch; duplicate submit returns the same order', async () => {
  assert.equal(await code(createOrder(runner(baseState()), parseCheckout({ items: [{ productId: 't1', qty: 1, size: 'M' }], deliveryMethod: 'PICKUP', branchId: 'zzz', customerName: 'Ali Ahmed', customerPhone: '01000000001', paymentMethod: 'COD' }), 'u1')), 'branch_invalid');
  const s = baseState(); const a = await createOrder(runner(s), input(), 'u1'); const b = await createOrder(runner(s), input(), 'u1');
  assert.equal(b.duplicate, true); assert.equal(b.id, a.id); assert.equal(s.orders.length, 1); assert.equal(s.products[0].variants[0].stock, 1);
});
test('duplicate order detection distinguishes different checkout requests with the same total', async () => {
  const s = baseState(), r = runner(s), first = input({ items: [{ productId: 't1', qty: 1, size: 'M' }] });
  const a = await createOrder(r, first, 'u1');
  const b = await createOrder(r, input({ items: [{ productId: 't1', qty: 1, size: 'M' }], city: 'Alexandria' }), 'u1');
  assert.equal(a.duplicate, false); assert.equal(b.duplicate, false);
  assert.notEqual(a.id, b.id); assert.equal(s.orders.length, 2); assert.equal(s.products[0].variants[0].stock, 1);
});
test('duplicate detection uses the injected time window and canonicalizes split cart lines', async () => {
  const s = baseState(), r = runner(s), now = new Date();
  s.products[0].variants[0].stock = 6;
  const first = input({ items: [{ productId: 't1', qty: 1, size: 'M' }, { productId: 'p1', qty: 1, size: 'M' }] });
  const a = await createOrder(r, first, 'u1', now);
  const retry = await createOrder(r, input({ items: [{ productId: 't1', qty: 2, size: 'M' }] }), 'u1', new Date(now.getTime() + 30_000));
  assert.equal(retry.duplicate, true); assert.equal(retry.id, a.id); assert.equal(retry.total, a.total);
  const expired = await createOrder(r, first, 'u1', new Date(now.getTime() + 61_000));
  assert.equal(expired.duplicate, false); assert.notEqual(expired.id, a.id);
});
test('unknown coupon is an error, not silently ignored', async () => {
  assert.equal(await code(createOrder(runner(baseState()), input({ couponCode: 'nope' }), 'u1')), 'coupon_invalid');
});
test('product variant updates validate sizes, colors, stock and duplicate combinations', () => {
  assert.deepEqual(parseProductVariants([
    { id: 'v1', size: 'L', color: 'Blue', stock: 4 },
    { size: 'M', color: 'Red', stock: 2 },
  ]), [
    { id: 'v1', size: 'L', color: 'Blue', stock: 4 },
    { id: undefined, size: 'M', color: 'Red', stock: 2 },
  ]);
  assert.deepEqual(parseProductVariants([{ id: 'v1', stock: 4, priceOverride: 12_500 }]), [{ id: 'v1', stock: 4, size: undefined, color: undefined, priceOverride: 12_500 }]);
  assert.throws(() => parseProductVariants([{ size: 'M', color: 'Red', stock: 1 }, { size: 'M', color: 'Red', stock: 2 }]), HttpError);
  assert.throws(() => parseProductVariants([{ id: 'v1', stock: -1 }]), HttpError);
});
test('rules: payment selectable + transitions', () => {
  const c = (code: string, status: MethodConfig['status'], enabled = true): MethodConfig => ({ code, enabled, status });
  assert.equal(paymentSelectable('COD', c('COD', 'NOT_CONFIGURED')), true);
  assert.equal(paymentSelectable('COD', c('COD', 'BLOCKED')), false);
  for (const st of ['NOT_CONFIGURED', 'SANDBOX', 'AWAITING_APPROVAL', 'DISABLED', 'BLOCKED'] as const) assert.equal(paymentSelectable('FAWRY', c('FAWRY', st)), false);
  assert.equal(paymentSelectable('FAWRY', c('FAWRY', 'READY')), false);
  assert.equal(paymentSelectable('FAWRY', c('FAWRY', 'READY', false)), false); assert.equal(paymentSelectable('FAWRY', null), false);
  const t = (over: object) => transitionError({ from: 'CONFIRMED', to: 'PREPARING', deliveryMethod: 'DELIVERY', paymentMethod: 'COD', paymentStatus: 'AWAITING_PAYMENT', ...over } as never);
  assert.equal(t({}), null);
  assert.equal(t({ paymentMethod: 'INSTAPAY' }), 'payment_not_verified');
  assert.equal(t({ paymentMethod: 'INSTAPAY', paymentStatus: 'PAID' }), null);
  assert.equal(t({ paymentMethod: 'INSTAPAY', to: 'CANCELLED' }), null);
  assert.equal(t({ paymentStatus: 'PAID', to: 'CANCELLED' }), 'refund_required');
  assert.equal(t({ paymentStatus: 'PENDING_REVIEW', to: 'CANCELLED' }), 'payment_review_required');
  assert.equal(t({ from: 'DELIVERED', to: 'PREPARING' }), 'invalid_transition');
  assert.equal(t({ from: 'PREPARING', to: 'READY_FOR_PICKUP' }), 'not_a_pickup_order');
  assert.equal(t({ from: 'CONFIRMED', to: 'DELIVERED' }), 'invalid_transition');
  assert.equal(paymentStatusAfterTransition('DELIVERED', 'COD', 'AWAITING_PAYMENT'), 'PAID');
  assert.equal(paymentStatusAfterTransition('DELIVERED', 'INSTAPAY', 'PAID'), 'PAID');
  assert.equal(paymentStatusAfterTransition('PREPARING', 'COD', 'AWAITING_PAYMENT'), 'AWAITING_PAYMENT');
});
test('validators reject bad input', () => {
  assert.throws(() => parseCheckout({}), HttpError);
  assert.throws(() => parseCheckout({ ...{ items: [{ productId: 'a', qty: 0 }] } }), HttpError);
  assert.throws(() => input({ customerPhone: '123' }), HttpError);
  assert.throws(() => input({ paymentMethod: 'BITCOIN' }), HttpError);
  assert.equal(input({ items: [{ productId: 'a', qty: 1 }, { productId: 'a', qty: 2 }] }).items[0].qty, 3);
  assert.equal(parseQuote({ items: [{ productId: 'a', qty: 1 }] }).deliveryMethod, 'DELIVERY');
  assert.throws(() => parseProductCreate({ name: 'x', categoryId: 'books', price: 100.5 }), HttpError);
  assert.throws(() => parseProductCreate({ name: 'Book', categoryId: 'books', price: 100, salePrice: 100 }), HttpError);
  assert.equal(parseProductCreate({ name: 'Book', categoryId: 'books', price: 100 }).variants.length, 1);
  assert.deepEqual(parseProductPatch({ images: ['/products/b1.jpg', 'https://images.example.test/book.jpg'] }).images, ['/products/b1.jpg', 'https://images.example.test/book.jpg']);
  assert.throws(() => parseProductPatch({ images: ['javascript:alert(1)'] }), HttpError);
  assert.throws(() => parseProductPatch({}), HttpError);
  assert.deepEqual(parseProductPatch({ active: true }), { active: true });
  assert.equal(parseProductQuery(new URLSearchParams('page=-4&pageSize=9999&sort=zzz')).pageSize, 48);
});
