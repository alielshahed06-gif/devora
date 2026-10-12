// Documents the chosen rounding rule: exact integer math, half-piaster rounds UP (D-014).
// The original demo used float math + Math.round(x*100)/100, which rounds exact halves DOWN in ~0.3% of cases
// (e.g. 10% of 1.45 EGP = 0.145 -> 0.14 because 1.45*10/100 = 0.14499999…). That is a float artifact, not a business rule.
import test from 'node:test'; import assert from 'node:assert/strict';
import { pct } from '../src/lib/money';
import { quote, type Catalog } from '../src/server/pricing/quote';

test('pct rounds exact half piasters up, deterministically', () => {
  assert.equal(pct(145, 10), 15);   // 14.5 -> 15 (original float gave 14)
  assert.equal(pct(190, 15), 29);   // 28.5 -> 29 (original gave 28)
  assert.equal(pct(285, 10), 29);
  assert.equal(pct(1000, 15), 150); // no rounding needed
  assert.equal(pct(0, 20), 0);
});
test('tier discount on a 1.45 EGP-style half case uses integer math', () => {
  const cat: Catalog = { products: [{ id: 'a', name: 'a', category: 'other', price: 145, salePrice: null, variants: [{ stock: 5 }] }], tiers: [{ min: 100, rate: 10 }], coupons: [], shippingFee: null, freeShippingMin: null };
  const q = quote(cat, { items: [{ productId: 'a', qty: 1 }], deliveryMethod: 'pickup' });
  assert.equal(q.tierDiscount, 15); assert.equal(q.total, 130);
});
test('result is always an integer number of piasters', () => {
  const cat: Catalog = { products: [{ id: 'a', name: 'a', category: 'books', price: 33333, salePrice: 31111, variants: [{ stock: 99 }] }], tiers: [{ min: 1, rate: 15 }], coupons: [{ code: 'X', label: 'x', type: 'percent', value: 15, minOrder: 0, active: true, uses: 0, categories: [], productIds: [] }], shippingFee: 3333, freeShippingMin: null };
  for (let qty = 1; qty <= 40; qty++) { const q = quote(cat, { items: [{ productId: 'a', qty }], couponCode: 'X', deliveryMethod: 'delivery' }); for (const k of ['total', 'tierDiscount', 'couponDiscount', 'afterProduct'] as const) assert.ok(Number.isInteger(q[k]), `${k} qty=${qty}`); }
});
