import test from 'node:test'; import assert from 'node:assert/strict';
import { products, categories, searchProducts, isAvailable, discountPct, unitPrice, getProduct, tiers } from '../src/lib/catalog';
import { addItem, changeQty, removeItem, parseStoredCart, cartCount, cartKey, type CartItem } from '../src/lib/cart';
import { quoteCart, stockOf } from '../src/lib/storefront';

test('catalog matches the extracted demo data', () => {
  assert.equal(products.length, 69); assert.equal(categories.length, 4);
  assert.equal(products.reduce((s, p) => s + p.variants.length, 0), 164);
  assert.equal(products.filter((p) => p.salePrice != null).length, 17);
  for (const p of products) { assert.ok(Number.isInteger(p.price) && p.price > 0, p.id); assert.ok(p.images.length >= 1 && p.images[0].startsWith('/products/'), p.id); if (p.salePrice != null) assert.ok(p.salePrice < p.price, p.id); }
  assert.deepEqual(tiers.map((t) => [t.min, t.rate]), [[240000, 20], [160000, 15], [80000, 10]]);
});
test('every referenced image exists in public/', async () => {
  const fs = await import('node:fs'); const path = await import('node:path');
  for (const p of products) for (const img of p.images) assert.ok(fs.existsSync(path.join(process.cwd(), 'public', img)), img);
});
test('search / filters', () => {
  assert.equal(searchProducts(products, { category: 'books' }).length, 3);
  assert.equal(searchProducts(products, { offers: true }).length, 17);
  assert.equal(searchProducts(products, { available: true }).length, 69);
  assert.ok(searchProducts(products, { q: 'ستيكر' }).length >= 3);
  assert.equal(searchProducts(products, { q: '  HELLO world ' }).length, searchProducts(products, { q: 'hello world' }).length);
  assert.equal(searchProducts(products, { q: 'zzzz-none' }).length, 0);
  const asc = searchProducts(products, { sort: 'price_asc' }).map(unitPrice); assert.deepEqual(asc, [...asc].sort((a, b) => a - b));
  const desc = searchProducts(products, { sort: 'price_desc' }).map(unitPrice); assert.deepEqual(desc, [...desc].sort((a, b) => b - a));
});
test('discount %', () => { const b1 = getProduct('b1')!; assert.equal(discountPct(b1), 17); assert.equal(unitPrice(b1), 15000); assert.ok(isAvailable(b1)); });
test('cart add / merge / stock limit / qty / remove', () => {
  let cart: CartItem[] = [];
  let r = addItem(cart, { productId: 'b1', size: null, color: null, qty: 2 }, stockOf); assert.ok(!r.error); cart = r.cart;
  r = addItem(cart, { productId: 'b1', size: null, color: null, qty: 3 }, stockOf); cart = r.cart; assert.equal(cart.length, 1); assert.equal(cart[0].qty, 5);
  r = addItem(cart, { productId: 'b1', size: null, color: null, qty: 6 }, stockOf); assert.match(r.error!, /المتاح 10/); assert.equal(r.cart[0].qty, 5);
  r = addItem(cart, { productId: 't1', size: 'M', color: 'بني', qty: 1 }, stockOf); cart = r.cart; assert.equal(cartCount(cart), 6);
  assert.ok(addItem(cart, { productId: 't1', size: 'XXL', color: 'بني', qty: 1 }, stockOf).error);
  assert.ok(addItem(cart, { productId: 'nope', size: null, color: null, qty: 1 }, stockOf).error);
  cart = changeQty(cart, cartKey(cart[0]), -99, stockOf).cart; assert.equal(cart[0].qty, 1);
  assert.ok(changeQty(cart, cartKey(cart[0]), 99, stockOf).error);
  cart = removeItem(cart, cartKey(cart[0])); assert.equal(cart.length, 1);
});
test('parseStoredCart is defensive', () => {
  assert.deepEqual(parseStoredCart(null), []); assert.deepEqual(parseStoredCart('{bad'), []); assert.deepEqual(parseStoredCart('{"a":1}'), []);
  const c = parseStoredCart(JSON.stringify([{ productId: 'b1', qty: 2 }, { productId: 'b1', size: '', qty: 1 }, { productId: 5, qty: 1 }, { productId: 'x', qty: -1 }, null]));
  assert.deepEqual(c, [{ productId: 'b1', size: null, color: null, qty: 3 }]);
});
test('cart totals use integer piasters and the tier discount', () => {
  const small = quoteCart([{ productId: 'b1', size: null, color: null, qty: 2 }]); // 2 x 150.00
  assert.equal(small.ok, true); assert.equal(small.subtotalOriginal, 36000); assert.equal(small.afterProduct, 30000); assert.equal(small.productDiscounts, 6000); assert.equal(small.tierRate, 0); assert.equal(small.total, 30000);
  const big = quoteCart([{ productId: 'b1', size: null, color: null, qty: 6 }]); // 900.00 -> 10% tier
  assert.equal(big.tierRate, 10); assert.equal(big.tierDiscount, 9000); assert.equal(big.total, 81000);
  for (const k of ['total', 'tierDiscount', 'afterProduct'] as const) assert.ok(Number.isInteger(big[k]));
  assert.equal(quoteCart([]).ok, false);
});
