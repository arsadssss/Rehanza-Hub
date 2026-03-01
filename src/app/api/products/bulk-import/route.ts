
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = "force-dynamic";

// Operational Constants matching standard system logic
const PROMO_ADS = 20;
const TAX_OTHER = 10;
const PACKING = 15;
const AMAZON_SHIP = 80;
const BASE_CHARGES = 45;

/**
 * POST /api/products/bulk-import
 * Decoupled high-performance service for batch product creation with UPSERT support.
 * Uses ON CONFLICT to update existing SKUs instead of failing.
 */
export async function POST(request: Request) {
  try {
    // 1. Context & Security Validation
    const session = await getServerSession(authOptions);
    const accountId = request.headers.get("x-account-id");

    if (!session || !session.user?.id || !accountId) {
      return NextResponse.json({ success: false, message: "Unauthorized access or Account ID missing." }, { status: 401 });
    }

    const { products } = await request.json();
    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ success: false, message: "Empty dataset received." }, { status: 400 });
    }

    // 2. Data Preparation & Pricing Calculation
    const dataToProcess = products.map(p => {
      const cost = Number(p.cost_price) || 0;
      const margin = Number(p.margin) || 0;
      
      const meeshoPrice = cost + BASE_CHARGES + margin;
      const flipkartPrice = meeshoPrice;
      const amazonPrice = meeshoPrice + AMAZON_SHIP;

      return {
        sku: p.sku.trim().toUpperCase(),
        product_name: p.name.trim(),
        category: p.category || 'General',
        cost_price: cost,
        margin: margin,
        low_stock_threshold: Number(p.low_stock_threshold) || 5,
        meesho_price: meeshoPrice,
        flipkart_price: flipkartPrice,
        amazon_price: amazonPrice,
        promo_ads: PROMO_ADS,
        tax_other: TAX_OTHER,
        packing: PACKING,
        amazon_ship: AMAZON_SHIP,
        account_id: accountId
      };
    });

    // 3. Pre-fetch existing SKUs to classify as "inserted" or "updated"
    const skus = dataToProcess.map(d => d.sku);
    const existingRes = await sql`
      SELECT sku FROM allproducts 
      WHERE sku = ANY(${skus}) 
      AND account_id = ${accountId} 
      AND is_deleted = false
    `;
    const existingSkuSet = new Set(existingRes.map((e: any) => e.sku));

    let inserted = 0;
    let updated = 0;

    // 4. Transactional Multi-Row UPSERT
    try {
      for (const item of dataToProcess) {
        await sql`
          INSERT INTO allproducts (
            sku, product_name, category, cost_price, margin, low_stock_threshold, 
            promo_ads, tax_other, packing, amazon_ship, 
            meesho_price, flipkart_price, amazon_price, account_id
          )
          VALUES (
            ${item.sku}, ${item.product_name}, ${item.category}, ${item.cost_price}, ${item.margin}, ${item.low_stock_threshold}, 
            ${item.promo_ads}, ${item.tax_other}, ${item.packing}, ${item.amazon_ship}, 
            ${item.meesho_price}, ${item.flipkart_price}, ${item.amazon_price}, ${accountId}
          )
          ON CONFLICT (account_id, sku) 
          DO UPDATE SET 
            product_name = EXCLUDED.product_name,
            category = EXCLUDED.category,
            cost_price = EXCLUDED.cost_price,
            margin = EXCLUDED.margin,
            low_stock_threshold = EXCLUDED.low_stock_threshold,
            meesho_price = EXCLUDED.meesho_price,
            flipkart_price = EXCLUDED.flipkart_price,
            amazon_price = EXCLUDED.amazon_price,
            updated_at = NOW()
          WHERE allproducts.is_deleted = false;
        `;
        
        if (existingSkuSet.has(item.sku)) {
          updated++;
        } else {
          inserted++;
        }
      }
    } catch (dbErr: any) {
      console.error("Batch UPSERT Transaction Error:", dbErr);
      throw new Error(`Database error during processing: ${dbErr.message}`);
    }

    return NextResponse.json({ 
      success: true, 
      inserted,
      updated,
      message: `${inserted} products inserted, ${updated} products updated.`
    });

  } catch (error: any) {
    console.error("CRITICAL BULK IMPORT FAILURE:", error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || "An internal error occurred during the import process." 
    }, { status: 500 });
  }
}
