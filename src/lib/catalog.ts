import data from '../data/catalog.json';
import type { Catalog, CatalogProduct } from '../server/pricing/quote';

/** Storefront view-model of a product. Money is integer piasters (see src/lib/money.ts). */
export interface Variant { size?: string; color?: string; stock: number; price?: number }
export interface Product { id: string; category: string; name: string; description: string; price: number; salePrice: number | null; images: string[]; createdAt: string; variants: Variant[] }
export interface Category { id: string; name: string; description?: string; imageUrl?: string | null }
export type SortKey = '' | 'newest' | 'price_asc' | 'price_desc';
export interface SearchParams { q?: string; category?: string; offers?: boolean; available?: boolean; sort?: SortKey }

export const categories: Category[] = data.categories;
export const products: Product[] = data.products as Product[];
export const tiers = data.tiers;
export const hero = data.hero;
export const policies = data.policies as Record<string, { title: string; text: string }>;

export const getProduct = (id: string) => products.find((p) => p.id === id);
export const getCategory = (id: string) => categories.find((c) => c.id === id);
export const isAvailable = (p: Product) => p.variants.some((v) => v.stock > 0);
export const unitPrice = (p: Product) => p.salePrice ?? p.price;
export const discountPct = (p: Product) => (p.salePrice != null ? Math.round((1 - p.salePrice / p.price) * 100) : 0);
export const SORTS: [SortKey, string][] = [['', 'الافتراضي'], ['newest', 'الأحدث'], ['price_asc', 'السعر: الأقل'], ['price_desc', 'السعر: الأعلى']];

/** Same semantics as GET /api/products in the original mock (substring match on name+description, case-insensitive). */
export function searchProducts(list: Product[], f: SearchParams = {}): Product[] {
  let out = list.slice();
  if (f.category) out = out.filter((x) => x.category === f.category);
  const t = (f.q ?? '').trim().toLowerCase();
  if (t) out = out.filter((x) => (x.name + ' ' + x.description).toLowerCase().includes(t));
  if (f.offers) out = out.filter((x) => x.salePrice != null);
  if (f.available) out = out.filter(isAvailable);
  if (f.sort === 'price_asc') out.sort((a, b) => unitPrice(a) - unitPrice(b));
  else if (f.sort === 'price_desc') out.sort((a, b) => unitPrice(b) - unitPrice(a));
  else if (f.sort === 'newest') out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return out;
}

/** Adapter for src/server/pricing/quote.ts (single source of truth for totals). */
export const quoteCatalog: Catalog = {
  products: products.map((p): CatalogProduct => ({ id: p.id, name: p.name, category: p.category, price: p.price, salePrice: p.salePrice, variants: p.variants })),
  tiers, coupons: [], shippingFee: null, freeShippingMin: null,
};
