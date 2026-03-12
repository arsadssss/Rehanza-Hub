import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * POST /api/products/create
 * Strictly handles creation of new products with all overhead fields.
 */
export async function POST(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    const body = await request.json();
    const {
      sku, category, product_name, 
      cost_price, margin, promo_ads, tax_other, packing,
      flipkart_ship, amazon_ship,
      meesho_price, flipkart_price, amazon_price,
      stock, low_stock_threshold
    } = body;

    if (!sku || !product_name || !accountId) {
      return NextResponse.json({ success: false, message: "Missing required product fields" }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO allproducts (
        sku, category, product_name, 
        cost_price, margin, promo_ads, tax_other, packing,
        flipkart_ship, amazon_ship,
        meesho_price, flipkart_price, amazon_price,
        stock, low_stock_threshold, account_id
      )
      VALUES (
        ${sku}, ${category}, ${product_name}, 
        ${cost_price}, ${margin}, ${promo_ads}, ${tax_other}, ${packing},
        ${flipkart_ship}, ${amazon_ship},
        ${meesho_price}, ${flipkart_price}, ${amazon_price},
        ${stock || 0}, ${low_stock_threshold || 5}, ${accountId}
      )
      RETURNING *;
    `;

    return NextResponse.json({ success: true, data: result[0] }, { status: 201 });
  } catch (error: any) {
    console.error("API Products Create Error:", error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || "Failed to create product" 
    }, { status: 500 });
  }
}
