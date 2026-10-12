// Golden-parity test: runs the ORIGINAL quote() extracted from the preserved HTML against the TS port.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm';
import { quote, type Catalog } from '../src/server/pricing/quote';

interface ReferenceVariant { size?: string | null; color?: string | null; stock: number; price: number | null }
interface ReferenceProduct { id: string; name: string; category: string; price: number; salePrice: number | null; variants: ReferenceVariant[] }
interface ReferenceCoupon {
  code: string; label: string; type: 'percent' | 'fixed'; value: number; minOrder: number; active: boolean;
  startsAt?: string | null; expiresAt?: string | null; maxUses?: number | null; uses: number; categories: string[]; productIds: string[];
}
interface ReferenceSeed {
  products: ReferenceProduct[];
  settings: { tiers: { min: number; rate: number }[]; shippingFee: number | null; freeShippingMin: number | null };
  coupons: ReferenceCoupon[];
}
interface ReferenceQuote {
  total: number; tierDiscount: number; couponDiscount: number; productDiscounts: number; shippingFee: number;
  ok: boolean; couponError?: string | null; errors: unknown[]; coupon?: unknown; tierRate: number;
}
interface ReferenceInput {
  items: { productId: string; size?: string | null; color?: string | null; qty: number }[];
  couponCode: string; deliveryMethod: 'delivery' | 'pickup';
}
type OriginalQuote = (db: ReferenceSeed, input: ReferenceInput, now: Date) => ReferenceQuote;

const root = path.resolve(__dirname, '..');
const lines = fs.readFileSync(path.join(root, 'reference/original-ui/dev-x-book-store-8-2.html'), 'utf8').split('\n');
const find = (re: RegExp, from = 0) => lines.findIndex((l, i) => i >= from && re.test(l));
const bs = find(/^const branchNames/), be = find(/^\];/, bs), ms = find(/^const MERCH = /), ss = find(/^const seed = /), se = find(/^\}\);/, ss);
const qs = find(/^const r2 = /), qe = find(/^\/\* نسخة العرض التجريبي/);
const ctx = vm.createContext({});
vm.runInContext([...lines.slice(bs, be + 1), ...lines.slice(ms, se + 1), ...lines.slice(qs, qe), 'this.seed=seed;this.quote=quote;'].join('\n'), ctx);
const seed = vm.runInContext('seed()', ctx) as ReferenceSeed;
const origQuote = vm.runInContext('quote', ctx) as OriginalQuote;

function rng(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const P = (n: number | null | undefined) => (n == null ? n : Math.round(n * 100));
const toCatalog = (db: ReferenceSeed): Catalog => ({
  products: db.products.map((p) => ({ id: p.id, name: p.name, category: p.category, price: P(p.price)!, salePrice: P(p.salePrice) ?? null, variants: p.variants.map((v) => ({ ...v, price: P(v.price) ?? null })) })),
  tiers: db.settings.tiers.map((t) => ({ min: P(t.min)!, rate: t.rate })),
  coupons: db.coupons.map((c) => ({ ...c, value: c.type === 'fixed' ? P(c.value)! : c.value, minOrder: P(c.minOrder)! })),
  shippingFee: P(db.settings.shippingFee) ?? null, freeShippingMin: P(db.settings.freeShippingMin) ?? null,
});

test('seed has expected shape', () => { assert.equal(seed.products.length, 69); assert.equal(seed.coupons.length, 3); });

test('TS quote() matches original quote() on 3000 random carts', () => {
  const r = rng(20261010); let withCoupon = 0, withTier = 0, driftCases = 0;
  for (let n = 0; n < 3000; n++) {
    const db = JSON.parse(JSON.stringify(seed)) as ReferenceSeed;
    if (r() < 0.5) { db.settings.shippingFee = [30, 45, 60][Math.floor(r() * 3)]; }
    if (r() < 0.4) { db.settings.freeShippingMin = [500, 900][Math.floor(r() * 2)]; }
    const items = Array.from({ length: 1 + Math.floor(r() * 6) }, () => {
      const p = db.products[Math.floor(r() * db.products.length)]; const v = p.variants[Math.floor(r() * p.variants.length)];
      return { productId: p.id, size: v.size, color: v.color, qty: 1 + Math.floor(r() * 14) };
    });
    const couponCode = ['', 'WELCOME10', 'BOOKS15', 'DEVX50', 'welcome10', 'NOPE'][Math.floor(r() * 6)];
    const deliveryMethod = r() < 0.5 ? 'delivery' : 'pickup';
    const now = new Date(r() < 0.1 ? '2028-06-01' : '2026-10-10');
    const a = origQuote(db, { items, couponCode, deliveryMethod }, now);
    const b = quote(toCatalog(db), { items, couponCode, deliveryMethod }, now);
    // The original does float math + Math.round(x*100)/100, which can land 1 piaster below an exact half-piaster
    // (e.g. 185.125 -> 185.12). The port uses exact integer math (rounds half up). Allow |diff| <= 1 piaster ONLY
    // on money fields that involve a percentage, and count them so a regression would still be visible.
    const near = (got: number, want: number, label: string) => { const d = Math.abs(got - Math.round(want * 100)); assert.ok(d <= 1, `${label} #${n}: ${got} vs ${Math.round(want * 100)}`); if (d) driftCases++; };
    near(b.total, a.total, 'total'); near(b.tierDiscount, a.tierDiscount, 'tier'); near(b.couponDiscount, a.couponDiscount, 'coupon');
    assert.equal(b.productDiscounts, Math.round(a.productDiscounts * 100), `productDiscounts #${n}`);
    assert.equal(b.shippingFee, Math.round(a.shippingFee * 100), `shipping #${n}`);
    assert.equal(b.ok, a.ok, `ok #${n}`); assert.equal(!!b.couponError, !!a.couponError, `couponError #${n}`);
    assert.equal(b.errors.length, a.errors.length, `errors #${n}`);
    if (b.coupon) withCoupon++; if (b.tierRate) withTier++;
  }
  assert.ok(driftCases <= 30, `too many 1-piaster drifts: ${driftCases}`); console.log(`1-piaster half-rounding drifts vs original: ${driftCases}/3000`);
  assert.ok(withCoupon > 100 && withTier > 100, `coverage too low: coupon=${withCoupon} tier=${withTier}`);
});
