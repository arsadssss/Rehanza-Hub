type SettlementParams = {
  cost: number;
  promoAds: number;
  taxFee: number;
  packing: number;
  shipping: number;
  profit: number;
};

/**
 * Calculates the final settlement amount based on various cost and profit parameters.
 *
 * @param params - The parameters for settlement calculation.
 * @returns The calculated settlement amount.
 */
export function calculateSettlement({
  cost,
  promoAds,
  taxFee,
  packing,
  shipping,
  profit,
}: SettlementParams): number {
  return cost + promoAds + taxFee + packing + shipping + profit;
}

/**
 * Calculates settlement for Meesho and Flipkart where shipping is considered zero.
 */
export function calculateMeeshoFlipkartSettlement(
  params: Omit<SettlementParams, 'shipping'>
) {
  return calculateSettlement({ ...params, shipping: 0 });
}

/**
 * Calculates settlement for Amazon, including specific Amazon shipping costs.
 */
export function calculateAmazonSettlement(
  params: Omit<SettlementParams, 'shipping'>,
  amazonShipping: number
) {
  return calculateSettlement({ ...params, shipping: amazonShipping });
}
