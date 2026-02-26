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
