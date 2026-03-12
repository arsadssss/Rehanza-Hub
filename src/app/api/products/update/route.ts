import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * PUT /api/products/update
 * Updates an existing product record.
 */
export async function PUT(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    const body = await request.json();
    const {
      id, sku, category, product_name, 
      cost_price, margin, promo_ads, tax_other, packing,
      flipkart_ship, amazon_ship,
      meesho_price, flipkart_price, amazon_price,
      stock, low_stock_threshold
    } = body;

    if (!sku || !product_name || !accountId) {
      return NextResponse.json({ success: false, message: "Missing required product fields" }, { status: 400 });
    }

    const result = await sql`
      UPDATE allproducts 
      SET 
        sku = ${sku},
        category = ${category},
        product_name = ${product_name},
        cost_price = ${cost_price},
        margin = ${margin},
        promo_ads = ${promo_ads},
        tax_other = ${tax_other},
        packing = ${packing},
        flipkart_ship = ${flipkart_ship},
        amazon_ship = ${amazon_ship},
        meesho_price = ${meesho_price},
        flipkart_price = ${flipkart_price},
        amazon_price = ${amazon_price},
        stock = ${stock},
        low_stock_threshold = ${low_stock_threshold}
      WHERE id = ${id} AND account_id = ${accountId}
      RETURNING *;
    `;

    if (result.length === 0) {
      return NextResponse.json({ success: false, message: "Product not found or access denied" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result[0] });
  } catch (error: any) {
    console.error("API Products Update Error:", error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || "Failed to update product" 
    }, { status: 500 });
  }
}
