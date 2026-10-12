/** Money is integer piasters everywhere server-side (1 EGP = 100 piasters). Never store floats. */
export type Piasters = number;

export const egpToPiasters = (egp: number): Piasters => Math.round(egp * 100);

export function assertPiasters(n: unknown, label = 'amount'): asserts n is Piasters {
  if (typeof n !== 'number' || !Number.isSafeInteger(n)) throw new TypeError(`${label} must be an integer number of piasters`);
}

/** percent of an amount, rounded to the nearest piaster (half away from zero for positives). */
export const pct = (amount: Piasters, ratePct: number): Piasters => Math.round((amount * ratePct) / 100);

/** Display only (UI layer). Locale: 'ar-EG' | 'en-EG'. */
export const formatEgp = (p: Piasters, locale = 'ar-EG'): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(p / 100);

/** Arabic storefront price display; arithmetic stays in integer piasters. */
export const formatPriceAr = (p: Piasters): string =>
  new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(p / 100) + ' ج.م';