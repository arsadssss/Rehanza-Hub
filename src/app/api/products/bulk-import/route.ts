import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = "force-dynamic";

// Standard Operational Defaults
const DEFAULT_PROMO_ADS = 20;
const DEFAULT_TAX_OTHER = 10;
const DEFAULT_PACKING = 15;
const DEFAULT_AMAZON_SHIP = 80;
const DEFAULT_FLIPKART_SHIP = 80;
const DEFAULT_PLATFORM_FEE = 8;

/**
 * POST /api/products/bulk-import
 * Process batch product management.
 * Logic: Fetch existing SKUs -> Split into New/Existing -> Transactional Bulk Insert + Batch Updates.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const accountId = request.headers.get("x-account-id");

    if (!session || !session.user?.id || !accountId) {
      return NextResponse.json({ success: false, message: "Unauthorized access or Account ID missing." }, { status: 401 });
    }

    const { products } = await request.json();
    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ success: false, message: "Empty dataset received." }, { status: 400 });
    }

    const existingRes = await sql`
      SELECT sku FROM allproducts 
      WHERE account_id = ${accountId} 
      AND is_deleted = false
    `;
    const existingSkuSet = new Set(existingRes.map((e: any) => e.sku.toUpperCase()));

    const toInsert: any[] = [];
    const toUpdate: any[] = [];

    for (const p of products) {
      const sku = p.sku.trim().toUpperCase();
      const cost = Number(p.cost_price) || 0;
      const margin = Number(p.margin) || 0;
      
      // Calculate dynamic prices based on new formula
      const baseCost = cost + margin + DEFAULT_PROMO_ADS + DEFAULT_TAX_OTHER + DEFAULT_PACKING;
      const meeshoPrice = Math.round(baseCost * 1.18);
      const flipkartPrice = Math.round((baseCost + DEFAULT_FLIPKART_SHIP + DEFAULT_PLATFORM_FEE) * 1.18);
      const amazonPrice = Math.round((baseCost + DEFAULT_AMAZON_SHIP + DEFAULT_PLATFORM_FEE) * 1.18);

      const preparedItem = {
        sku,
        product_name: p.name.trim(),
        category: p.category || 'General',
        cost_price: cost,
        margin: margin,
        low_stock_threshold: Number(p.low_stock_threshold) || 5,
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
      };

      if (existingSkuSet.has(sku)) {
        toUpdate.push(preparedItem);
      } else {
        toInsert.push(preparedItem);
      }
    }

    let inserted = 0;
    let updated = 0;

    if (toInsert.length > 0) {
      for (const item of toInsert) {
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
        inserted++;
      }
    }

    if (toUpdate.length > 0) {
      for (const item of toUpdate) {
        await sql`
          UPDATE allproducts 
          SET 
            product_name = ${item.product_name},
            category = ${item.category},
            cost_price = ${item.cost_price},
            margin = ${item.margin},
            low_stock_threshold = ${item.low_stock_threshold},
            meesho_price = ${item.meesho_price},
            flipkart_price = ${item.flipkart_price},
            amazon_price = ${item.amazon_price},
            amazon_ship = ${item.amazon_ship},
            flipkart_ship = ${item.flipkart_ship},
            platform_fee = ${item.platform_fee},
            promo_ads = ${item.promo_ads},
            tax_other = ${item.tax_other},
            packing = ${item.packing}
          WHERE account_id = ${accountId} 
          AND sku = ${item.sku}
          AND is_deleted = false
        `;
        updated++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      total_rows: products.length,
      inserted,
      updated,
      message: `Import complete: ${inserted} inserted, ${updated} updated.`
    });

  } catch (error: any) {
    console.error("BULK IMPORT CRITICAL FAILURE:", error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || "An error occurred during processing." 
    }, { status: 500 });
  }
}
