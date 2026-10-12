import { cartKey, type CartItem, type StockLookup } from './cart';
import { getProduct, quoteCatalog } from './catalog';
import { quote } from '../server/pricing/quote';

export const stockOf: StockLookup = (productId, size, color) => {
  const p = getProduct(productId); if (!p) return null;
  const v = p.variants.find((x) => (x.size || null) === (size || null) && (x.color || null) === (color || null));
  return v ? v.stock : null;
};
/** Totals via the shared integer-piasters pricing engine (tier discount applies; coupons/shipping are Stage 3). */
export const quoteCart = (cart: CartItem[]) => quote(quoteCatalog, { items: cart.map((i) => ({ productId: i.productId, qty: i.qty, size: i.size, color: i.color })) });
export { cartKey };
