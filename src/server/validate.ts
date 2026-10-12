import { HttpError } from './http';
import { normPhone, validEmail, validPhone } from '../lib/validation';

type Obj = Record<string, unknown>;
const bad = (details: Record<string, string>): never => { throw new HttpError(400, 'validation', 'بيانات غير صحيحة.', details); };
const asObj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : bad({ _: 'object expected' }));
const text = (o: Obj, k: string, min: number, max: number, errs: Record<string, string>, optional = false): string => {
  const v = o[k];
  if (v == null || v === '') { if (!optional) errs[k] = 'required'; return ''; }
  if (typeof v !== 'string') { errs[k] = 'string expected'; return ''; }
  const s = v.trim();
  if (s.length < min || s.length > max) errs[k] = `length ${min}-${max}`;
  return s;
};
const done = <T>(errs: Record<string, string>, v: T): T => (Object.keys(errs).length ? bad(errs) : v);

export function parseRegister(raw: unknown) {
  const o = asObj(raw), e: Record<string, string> = {};
  const name = text(o, 'name', 2, 80, e);
  const phone = normPhone(o.phone); if (!validPhone(phone)) e.phone = 'invalid Egyptian mobile';
  const emailRaw = text(o, 'email', 3, 120, e, true); if (emailRaw && !validEmail(emailRaw)) e.email = 'invalid';
  const password = typeof o.password === 'string' ? o.password : ''; if (password.length < 8 || password.length > 128) e.password = 'length 8-128';
  return done(e, { name, phone, email: emailRaw ? emailRaw.toLowerCase() : null, password });
}
export function parseLogin(raw: unknown) {
  const o = asObj(raw), e: Record<string, string> = {};
  const identifier = text(o, 'identifier', 3, 120, e);
  const password = typeof o.password === 'string' && o.password.length <= 128 ? o.password : ((e.password = 'required'), '');
  const id = identifier.includes('@') ? { email: identifier.toLowerCase(), phone: null } : { email: null, phone: normPhone(identifier) };
  return done(e, { ...id, password });
}

export const PAYMENT_CODES = ['COD', 'FAWRY', 'INSTAPAY', 'WALLET', 'VODAFONE_CASH', 'ORANGE_CASH', 'ETISALAT_CASH'] as const;
export type PaymentCode = (typeof PAYMENT_CODES)[number];
export interface CheckoutInput {
  items: { productId: string; qty: number; size: string | null; color: string | null }[];
  couponCode: string; deliveryMethod: 'DELIVERY' | 'PICKUP'; city: string; address: string; branchId: string | null;
  customerName: string; customerPhone: string; notes: string; paymentMethod: PaymentCode;
}
export function parseCheckout(raw: unknown): CheckoutInput {
  const o = asObj(raw), e: Record<string, string> = {};
  const rawItems = Array.isArray(o.items) ? o.items : (e.items = 'array expected', []);
  if (rawItems.length < 1 || rawItems.length > 50) e.items = 'between 1 and 50 items';
  const merged = new Map<string, CheckoutInput['items'][number]>();
  for (const it of rawItems.slice(0, 50)) {
    const x = it && typeof it === 'object' ? (it as Obj) : {};
    const qty = Number(x.qty);
    if (typeof x.productId !== 'string' || !x.productId || x.productId.length > 64 || !Number.isInteger(qty) || qty < 1 || qty > 99) { e.items = 'invalid item'; continue; }
    const size = typeof x.size === 'string' && x.size ? x.size.slice(0, 40) : null, color = typeof x.color === 'string' && x.color ? x.color.slice(0, 40) : null;
    const k = [x.productId, size ?? '', color ?? ''].join('|'), ex = merged.get(k); // merge duplicates so stock checks can't be bypassed by splitting a line
    merged.set(k, { productId: x.productId, size, color, qty: Math.min(99, (ex?.qty ?? 0) + qty) });
  }
  const deliveryMethod = o.deliveryMethod === 'PICKUP' ? 'PICKUP' : o.deliveryMethod === 'DELIVERY' ? 'DELIVERY' : (e.deliveryMethod = 'DELIVERY or PICKUP', 'DELIVERY' as const);
  const paymentMethod = PAYMENT_CODES.find((c) => c === o.paymentMethod) ?? ((e.paymentMethod = 'unknown payment method'), 'COD' as PaymentCode);
  const customerName = text(o, 'customerName', 2, 80, e);
  const customerPhone = normPhone(o.customerPhone); if (!validPhone(customerPhone)) e.customerPhone = 'invalid Egyptian mobile';
  const notes = text(o, 'notes', 0, 500, e, true);
  const couponCode = text(o, 'couponCode', 0, 20, e, true).toUpperCase();
  let city = '', address = '', branchId: string | null = null;
  if (deliveryMethod === 'DELIVERY') { city = text(o, 'city', 2, 80, e); address = text(o, 'address', 5, 300, e); }
  else { branchId = typeof o.branchId === 'string' && o.branchId && o.branchId.length <= 64 ? o.branchId : ((e.branchId = 'required'), null); }
  return done(e, { items: [...merged.values()], couponCode, deliveryMethod, city, address, branchId, customerName, customerPhone, notes, paymentMethod });
}

export function parsePaymentReference(raw: unknown) {
  const o = asObj(raw), e: Record<string, string> = {};
  const reference = text(o, 'reference', 4, 64, e); if (reference && !/^[A-Za-z0-9._\-]+$/.test(reference)) e.reference = 'letters, digits, . _ - only';
  const senderPhone = normPhone(o.senderPhone ?? ''); if (senderPhone && !validPhone(senderPhone)) e.senderPhone = 'invalid';
  return done(e, { reference, senderPhone });
}

export function parseProductQuery(sp: URLSearchParams) {
  const page = Math.max(1, Math.floor(Number(sp.get('page') ?? 1)) || 1);
  const pageSize = Math.min(48, Math.max(1, Math.floor(Number(sp.get('pageSize') ?? 24)) || 24));
  const sortRaw = sp.get('sort') ?? '';
  const sort = (['newest', 'price_asc', 'price_desc'] as const).find((s) => s === sortRaw) ?? 'newest';
  const category = (sp.get('category') ?? '').slice(0, 40), q = (sp.get('q') ?? '').trim().slice(0, 80);
  return { page, pageSize, sort, category, q, offers: sp.get('offers') === '1', available: sp.get('available') === '1' };
}

const money = (o: Obj, k: string, e: Record<string, string>, optional = false): number | null => {
  const v = o[k]; if (v == null) { if (!optional) e[k] = 'required'; return null; }
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v <= 0 || v > 100_000_000) { e[k] = 'integer piasters > 0'; return null; } return v;
};
export function parseProductCreate(raw: unknown) {
  const o = asObj(raw), e: Record<string, string> = {};
  const name = text(o, 'name', 2, 160, e), categoryId = text(o, 'categoryId', 1, 40, e), description = text(o, 'description', 0, 4000, e, true);
  const price = money(o, 'price', e), salePrice = money(o, 'salePrice', e, true);
  if (price != null && salePrice != null && salePrice >= price) e.salePrice = 'must be < price';
  const legacyId = text(o, 'legacyId', 0, 40, e, true) || null;
  const variants = (Array.isArray(o.variants) ? o.variants : []).slice(0, 100).map((v, i) => {
    const x = (v && typeof v === 'object' ? v : {}) as Obj;
    const stock = Number(x.stock); if (!Number.isInteger(stock) || stock < 0 || stock > 100000) e[`variants.${i}.stock`] = 'integer >= 0';
    const po = x.priceOverride == null ? null : Number(x.priceOverride); if (po != null && (!Number.isSafeInteger(po) || po <= 0)) e[`variants.${i}.priceOverride`] = 'invalid';
    return { size: typeof x.size === 'string' ? x.size.slice(0, 40) : '', color: typeof x.color === 'string' ? x.color.slice(0, 40) : '', stock, priceOverride: po };
  });
  const images = parseProductImages(o.images, e) ?? [];
  return done(e, { name, categoryId, description, price: price as number, salePrice, legacyId, variants: variants.length ? variants : [{ size: '', color: '', stock: 0, priceOverride: null }], images });
}
function parseProductImages(raw: unknown, errors: Record<string, string>) {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.length > 10) { errors.images = 'array of at most 10 image URLs expected'; return []; }
  const images: string[] = [];
  for (const [index, value] of raw.entries()) {
    if (typeof value !== 'string' || !isSafeProductImageUrl(value.trim())) {
      errors[`images.${index}`] = 'use a safe local image path or an HTTPS URL';
      continue;
    }
    const url = value.trim();
    if (images.includes(url)) errors[`images.${index}`] = 'duplicate image URL';
    else images.push(url);
  }
  return images;
}
export function isSafeProductImageUrl(value: string) {
  if (/^\/(?!\/)[A-Za-z0-9._/-]+$/.test(value) && !value.split('/').includes('..')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}
export function parseProductPatch(raw: unknown) {
  const o = asObj(raw), e: Record<string, string> = {}, out: { name?: string; description?: string; price?: number; salePrice?: number | null; active?: boolean; categoryId?: string; legacyId?: string | null; images?: string[] } = {};
  if ('name' in o) out.name = text(o, 'name', 2, 160, e);
  if ('description' in o) out.description = text(o, 'description', 0, 4000, e, true);
  if ('categoryId' in o) out.categoryId = text(o, 'categoryId', 1, 40, e);
  if ('legacyId' in o) out.legacyId = text(o, 'legacyId', 0, 40, e, true) || null;
  if ('images' in o) out.images = parseProductImages(o.images, e) ?? [];
  if ('price' in o) out.price = money(o, 'price', e) ?? undefined;
  if ('salePrice' in o) out.salePrice = o.salePrice === null ? null : money(o, 'salePrice', e);
  if ('active' in o) { if (typeof o.active === 'boolean') out.active = o.active; else e.active = 'boolean'; }
  if (!Object.keys(out).length && !Object.keys(e).length) e._ = 'no fields';
  return done(e, out);
}

export function parseProductVariants(raw: unknown) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 100) return bad({ variants: 'array of at most 100 variants expected' });
  const e: Record<string, string> = {};
  const ids = new Set<string>(), keys = new Set<string>();
  const variants = raw.map((value, i) => {
    const x = value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {};
    const id = x.id === undefined ? undefined : typeof x.id === 'string' && x.id.length > 0 && x.id.length <= 64 ? x.id : (e[`variants.${i}.id`] = 'invalid', undefined);
    const size = x.size === undefined ? undefined : text(x, 'size', 0, 40, e, true);
    const color = x.color === undefined ? undefined : text(x, 'color', 0, 40, e, true);
    const stock = Number(x.stock);
    if (!Number.isInteger(stock) || stock < 0 || stock > 100000) e[`variants.${i}.stock`] = 'integer between 0 and 100000';
    let priceOverride: number | null | undefined;
    if ('priceOverride' in x) {
      const value = x.priceOverride;
      if (value === null || value === '') priceOverride = null;
      else if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 100_000_000) priceOverride = value;
      else e[`variants.${i}.priceOverride`] = 'price in piasters > 0 or null';
    }
    if (!id && (size === undefined || color === undefined)) e[`variants.${i}`] = 'size and color are required for a new variant';
    if (id && ids.has(id)) e[`variants.${i}.id`] = 'duplicate variant id';
    if (id) ids.add(id);
    if (size !== undefined || color !== undefined) {
      const key = `${size ?? ''}|${color ?? ''}`;
      if (keys.has(key)) e[`variants.${i}`] = 'duplicate size and color';
      keys.add(key);
    }
    return { id, size, color, stock, ...(priceOverride === undefined ? {} : { priceOverride }) };
  });
  return done(e, variants);
}

export function parseQuote(raw: unknown) {
  const o = asObj(raw);
  const c = parseCheckout({ customerName: 'xx', customerPhone: '01000000000', paymentMethod: 'COD', city: 'xx', address: 'xxxxx', branchId: 'x', deliveryMethod: o.deliveryMethod === 'PICKUP' ? 'PICKUP' : 'DELIVERY', items: o.items, couponCode: o.couponCode });
  return { items: c.items, couponCode: c.couponCode, deliveryMethod: c.deliveryMethod };
}
