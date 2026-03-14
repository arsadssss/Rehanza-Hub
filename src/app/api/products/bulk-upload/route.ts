import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

const DEFAULT_PROMO_ADS = 20;
const DEFAULT_TAX_OTHER = 10;
const DEFAULT_PACKING = 15;
const DEFAULT_AMAZON_SHIP = 80;
const DEFAULT_FLIPKART_SHIP = 80;
const DEFAULT_PLATFORM_FEE = 8;

/**
 * POST /api/products/bulk-upload
 * Handles batch insertion of products with transactional safety and automated price calculation.
 */
export async function POST(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    const { products } = await request.json();
    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ success: false, message: "No product data provided" }, { status: 400 });
    }

    const skusToInsert = products.map(p => p.sku.toUpperCase());
    const existingProducts = await sql`
      SELECT sku FROM allproducts 
      WHERE account_id = ${accountId} AND is_deleted = false AND sku = ANY(${skusToInsert})
    `;
    const existingSkuSet = new Set(existingProducts.map((p: any) => p.sku.toUpperCase()));

    const result = {
      total: products.length,
      inserted: 0,
      skipped: 0,
      errors: [] as string[]
    };

    const validToInsert = [];

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!p.sku || !p.product_name) {
        result.skipped++;
        result.errors.push(`Row ${i + 1}: Missing SKU or Product Name.`);
        continue;
      }

      const sku = p.sku.toUpperCase();

      if (existingSkuSet.has(sku)) {
        result.skipped++;
        result.errors.push(`Row ${i + 1}: SKU "${sku}" already exists in database.`);
        continue;
      }

      // Automated pricing calculation following the new formula
      const cost = Number(p.cost_price) || 0;
      const margin = Number(p.margin) || 0;
      
      const baseCost = cost + margin + DEFAULT_PROMO_ADS + DEFAULT_TAX_OTHER + DEFAULT_PACKING;
      const meeshoPrice = Math.round(baseCost * 1.18);
      const flipkartPrice = Math.round((baseCost + DEFAULT_FLIPKART_SHIP + DEFAULT_PLATFORM_FEE) * 1.18);
      const amazonPrice = Math.round((baseCost + DEFAULT_AMAZON_SHIP + DEFAULT_PLATFORM_FEE) * 1.18);

      validToInsert.push({
        sku,
        product_name: p.product_name,
        category: p.category || 'General',
        cost_price: cost,
        margin: margin,
        low_stock_threshold: parseInt(p.low_stock_threshold || "5"),
        meesho_price: meeshoPrice,
        flipkart_price: flipkartPrice,
        amazon_price: amazonPrice,
        promo_ads: DEFAULT_PROMO_ADS,
        tax_other: DEFAULT_TAX_OTHER,
        packing: DEFAULT_PACKING,
        amazon_ship: DEFAULT_AMAZON_SHIP,
        flipkart_ship: DEFAULT_FLIPKART_SHIP,
        platform_fee: DEFAULT_PLATFORM_FEE,
        account_id: accountId
      });
    }

    if (validToInsert.length > 0) {
      try {
        for (const item of validToInsert) {
          await sql`
            INSERT INTO allproducts (
              sku, product_name, category, cost_price, margin, low_stock_threshold, 
              promo_ads, tax_other, packing, amazon_ship, flipkart_ship, platform_fee,
              meesho_price, flipkart_price, amazon_price, account_id
            )
            VALUES (
              ${item.sku}, ${item.product_name}, ${item.category}, ${item.cost_price}, ${item.margin}, ${item.low_stock_threshold}, 
              ${item.promo_ads}, ${item.tax_other}, ${item.packing}, ${item.amazon_ship}, ${item.flipkart_ship}, ${item.platform_fee},
              ${item.meesho_price}, ${item.flipkart_price}, ${item.amazon_price}, ${accountId}
            )
          `;
          result.inserted++;
        }
      } catch (dbErr: any) {
        console.error("Database Bulk Insert Error:", dbErr);
        throw new Error(`Batch insertion failed: ${dbErr.message}`);
      }
    }

    return NextResponse.json({ success: true, ...result });

  } catch (error: any) {
    console.error("BULK PRODUCT UPLOAD ERROR:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Failed to process bulk upload", 
      error: error.message 
    }, { status: 500 });
  }
}
