/**
 * Centralized Canonical Status Normalization for Meesho Reconciliation
 * 
 * Maps raw status strings from Meesho Orders CSV (e.g. DELIVERED, RTO_COMPLETE, CANCELLED)
 * and Payments CSV (Live Order Status) into the 6 canonical statuses established by the workbook:
 * - Delivered
 * - Shipped
 * - Exchange
 * - Return
 * - RTO
 * - Cancel
 */

export type CanonicalOrderStatus =
  | 'Delivered'
  | 'Shipped'
  | 'Exchange'
  | 'Return'
  | 'RTO'
  | 'Cancel'
  | 'Unknown';

/**
 * Normalizes any raw order or payment status into one of the 6 canonical statuses.
 * 
 * Rules:
 * - DELIVERED, Delivered -> 'Delivered'
 * - RETURN, Return, CUSTOMER_RETURN, COURIER_RETURN -> 'Return'
 * - EXCHANGE, Exchange -> 'Exchange'
 * - RTO, RTO_COMPLETE, RTO_LOCKED, RTO In Transit, or starting with RTO -> 'RTO'
 * - SHIPPED, Shipped, READY_TO_SHIP, IN_TRANSIT -> 'Shipped'
 * - CANCEL, CANCELLED, CANCELED, Cancelled, LOST -> 'Cancel'
 * - Empty/null/unrecognized -> 'Unknown'
 */
export function normalizeReconciliationStatus(rawStatus?: string | null): CanonicalOrderStatus {
  if (!rawStatus) return 'Unknown';
  const clean = rawStatus.trim();
  if (!clean) return 'Unknown';
  const upper = clean.toUpperCase();

  // 1. Delivered
  if (upper === 'DELIVERED') {
    return 'Delivered';
  }

  // 2. Return (Customer / Courier Return)
  if (
    upper === 'RETURN' ||
    upper === 'CUSTOMER_RETURN' ||
    upper === 'COURIER_RETURN' ||
    (upper.includes('RETURN') && !upper.includes('RTO'))
  ) {
    return 'Return';
  }

  // 3. Exchange
  if (upper === 'EXCHANGE') {
    return 'Exchange';
  }

  // 4. RTO (Return To Origin)
  if (
    upper === 'RTO' ||
    upper === 'RTO_COMPLETE' ||
    upper === 'RTO_LOCKED' ||
    upper.startsWith('RTO')
  ) {
    return 'RTO';
  }

  // 5. Shipped & Ready to Ship (in courier / warehouse logistics pipeline)
  if (
    upper === 'SHIPPED' ||
    upper === 'READY_TO_SHIP' ||
    upper === 'IN_TRANSIT'
  ) {
    return 'Shipped';
  }

  // 6. Cancel & Lost (Orders cancelled by customer/seller or lost in transit)
  if (
    upper === 'CANCEL' ||
    upper === 'CANCELLED' ||
    upper === 'CANCELED' ||
    upper === 'LOST'
  ) {
    return 'Cancel';
  }

  return 'Unknown';
}

