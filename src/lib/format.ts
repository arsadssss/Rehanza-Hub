/**
 * Global currency formatter for the application.
 * Uses Indian numbering system (en-IN) and Rupee symbol (INR).
 *
 * @param amount - The numeric value to format
 * @returns A formatted currency string (e.g., ₹1,00,000)
 */
export function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

/**
 * Format currency with 2 decimal places for financial reporting
 */
export function formatINRWithDecimals(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}
