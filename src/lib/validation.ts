/** Ported from the original demo (reference/original-ui) so server-side rules match the UI. */
export const normPhone = (s: unknown): string => String(s ?? '').replace(/[\s\-+]/g, '').replace(/^2(?=01)/, '');
export const validPhone = (s: unknown): boolean => /^01[0-25]\d{8}$/.test(normPhone(s));
export const validEmail = (s: unknown): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s ?? ''));
