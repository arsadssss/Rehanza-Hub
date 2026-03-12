/**
 * Pricing Engine Utility for Rehanza Hub
 * 
 * Logic:
 * 1. Base Cost = Cost Price + Margin + Promo/Ads + Tax Other + Packing
 * 2. Platform Price = (Base Cost + Platform Shipping) * 1.18 (GST)
 */

export function calculatePlatformPrices(product: {
  cost_price: number;
  margin: number;
  promo_ads: number;
  tax_other: number;
  packing: number;
  flipkart_ship: number;
  amazon_ship: number;
}) {
  const baseCost =
    Number(product.cost_price || 0) +
    Number(product.margin || 0) +
    Number(product.promo_ads || 0) +
    Number(product.tax_other || 0) +
    Number(product.packing || 0);

  // Meesho price: base cost + 18% GST
  const meesho_price = Math.round(baseCost * 1.18);

  // Flipkart price: (base cost + flipkart_ship) + 18% GST
  const flipkart_price = Math.round(
    (baseCost + Number(product.flipkart_ship || 0)) * 1.18
  );

  // Amazon price: (base cost + amazon_ship) + 18% GST
  const amazon_price = Math.round(
    (baseCost + Number(product.amazon_ship || 0)) * 1.18
  );

  return {
    meesho_price,
    flipkart_price,
    amazon_price
  };
}
