/**
 * Pricing Engine Utility
 * 
 * Logic:
 * 1. Base Cost = Cost Price + Margin + Promo/Ads + Tax Other + Packing
 * 2. Platform Price = (Base Cost + Platform Shipping) * 1.18 (GST)
 */

export function calculateProductPrices(data: any) {
  const baseCost =
    Number(data.cost_price || 0) +
    Number(data.margin || 0) +
    Number(data.promo_ads || 0) +
    Number(data.tax_other || 0) +
    Number(data.packing || 0);

  // Meesho price is base cost + 18% GST (no extra shipping field used in base)
  const meesho = Math.round(baseCost * 1.18);

  // Flipkart price includes flipkart_ship field from form before GST
  const flipkart = Math.round(
    (baseCost + Number(data.flipkart_ship || 0)) * 1.18
  );

  // Amazon price includes amazon_ship field from form before GST
  const amazon = Math.round(
    (baseCost + Number(data.amazon_ship || 0)) * 1.18
  );

  return {
    meesho_price: meesho,
    flipkart_price: flipkart,
    amazon_price: amazon
  };
}
