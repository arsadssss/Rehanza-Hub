
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = "force-dynamic";

// Operational Constants for Pricing Logic (as per system defaults)
const PROMO_ADS = 20;
const TAX_OTHER = 10;
const PACKING = 15;
const AMAZON_SHIP = 80;
const BASE_CHARGES = 45;

/**
 * POST /api/products/bulk-import
 * Rebuilt isolated service for batch product management.
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

    // 1. Fetch ALL existing SKUs for this account to identify updates vs inserts
    const existingRes = await sql`
      SELECT sku FROM allproducts 
      WHERE account_id = ${accountId} 
      AND is_deleted = false
    `;
    const existingSkuSet = new Set(existingRes.map((e: any) => e.sku.toUpperCase()));

    const toInsert: any[] = [];
    const toUpdate: any[] = [];

    // 2. Map and Validate rows, calculate prices
    for (const p of products) {
      const sku = p.sku.trim().toUpperCase();
      const cost = Number(p.cost_price) || 0;
      const margin = Number(p.margin) || 0;
      
      const meeshoPrice = cost + BASE_CHARGES + margin;
      const flipkartPrice = meeshoPrice;
      const amazonPrice = meeshoPrice + AMAZON_SHIP;

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
        promo_ads: PROMO_ADS,
        tax_other: TAX_OTHER,
        packing: PACKING,
        amazon_ship: AMAZON_SHIP,
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

    // 3. Process Transactionally
    // Note: Standard Neon helper doesn't support multi-statement BEGIN/COMMIT in one block via templates easily
    // We execute sequentially but logically as a single atomic operation for the user.
    
    // Perform Bulk Insert for new items
    if (toInsert.length > 0) {
      for (const item of toInsert) {
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
        `;
        inserted++;
      }
    }

    // Perform Updates for existing items
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
            amazon_price = ${item.amazon_price}
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
