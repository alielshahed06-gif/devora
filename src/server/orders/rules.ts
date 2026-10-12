/** Pure order/payment business rules (no DB). */
export type OrderStatus = 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'READY_FOR_PICKUP' | 'DELIVERED' | 'CANCELLED';
export type PaymentStatus = 'AWAITING_PAYMENT' | 'PENDING_REVIEW' | 'PAID';
export type ConfigStatus = 'NOT_CONFIGURED' | 'SANDBOX' | 'AWAITING_APPROVAL' | 'READY' | 'DISABLED' | 'BLOCKED';
export interface MethodConfig { code: string; enabled: boolean; status: ConfigStatus }

/** COD follows store settings (enabled and not disabled/blocked). Every online method must be READY — never offered while NOT_CONFIGURED/SANDBOX/etc. */
export function paymentSelectable(code: string, cfg: MethodConfig | null | undefined): boolean {
  if (!cfg || !cfg.enabled) return false;
  if (code === 'COD') return cfg.status !== 'DISABLED' && cfg.status !== 'BLOCKED';
  return false;
}
export const MANUAL_REFERENCE_METHODS = ['FAWRY', 'INSTAPAY', 'WALLET', 'VODAFONE_CASH', 'ORANGE_CASH', 'ETISALAT_CASH'];

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['OUT_FOR_DELIVERY', 'READY_FOR_PICKUP', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  READY_FOR_PICKUP: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [], CANCELLED: [],
};
export interface TransitionCtx { from: OrderStatus; to: OrderStatus; deliveryMethod: 'DELIVERY' | 'PICKUP'; paymentMethod: string; paymentStatus: PaymentStatus }
/** Returns null when allowed, otherwise a reason code. */
export function transitionError(c: TransitionCtx): string | null {
  if (!NEXT[c.from]?.includes(c.to)) return 'invalid_transition';
  if (c.to === 'CANCELLED' && c.paymentStatus === 'PAID') return 'refund_required';
  if (c.to === 'CANCELLED' && c.paymentStatus === 'PENDING_REVIEW') return 'payment_review_required';
  if (c.to === 'OUT_FOR_DELIVERY' && c.deliveryMethod !== 'DELIVERY') return 'not_a_delivery_order';
  if (c.to === 'READY_FOR_PICKUP' && c.deliveryMethod !== 'PICKUP') return 'not_a_pickup_order';
  // Prepaid orders are not fulfilled until payment is verified. COD is paid on delivery.
  if (c.to !== 'CANCELLED' && c.paymentMethod !== 'COD' && c.from === 'CONFIRMED' && c.paymentStatus !== 'PAID') return 'payment_not_verified';
  return null;
}

export function paymentStatusAfterTransition(to: OrderStatus, paymentMethod: string, current: PaymentStatus): PaymentStatus {
  return to === 'DELIVERED' && paymentMethod === 'COD' ? 'PAID' : current;
}
