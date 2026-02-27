import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * POST /api/variants
 * Creates a new product variant with automated SKU generation.
 */
export async function POST(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ message: "Account not selected" }, { status: 400 });
    }

    const body = await request.json();
    const { product_id, color, size, stock } = body;

    if (!product_id) {
      return NextResponse.json({ message: "Product ID is required" }, { status: 400 });
    }

    const productCheck = await sql`
      SELECT id, sku 
      FROM allproducts 
      WHERE id = ${product_id} 
      AND account_id = ${accountId}
      LIMIT 1
    `;

    if (productCheck.length === 0) {
      return NextResponse.json({ message: "Access denied or product not found" }, { status: 403 });
    }

    // Generate variant SKU: SKU-COLOR-SIZE (ignoring empty parts)
    const variantSku = [productCheck[0].sku, color, size]
      .filter(Boolean)
      .join('-')
      .toUpperCase();

    const result = await sql`
      INSERT INTO product_variants 
      (
        product_id,
        color,
        size,
        stock,
        low_stock_threshold,
        variant_sku,
        account_id
      )
      VALUES 
      (
        ${product_id},
        ${color || null},
        ${size || null},
        ${stock ?? 0},
        5,
        ${variantSku},
        ${accountId}
      )
      RETURNING *;
    `;

    return NextResponse.json(result[0], { status: 201 });

  } catch (error: any) {
    console.error("API Variants POST Error:", error);
    return NextResponse.json(
      {
        message: "Failed to create variant",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/variants
 * Updates the stock level for an existing variant.
 */
export async function PUT(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ message: "Account not selected" }, { status: 400 });
    }

    const body = await request.json();
    const { id, stock } = body;

    if (!id || stock === undefined) {
      return NextResponse.json({ message: "ID and Stock are required" }, { status: 400 });
    }

    const result = await sql`
      UPDATE product_variants
      SET stock = ${stock}
      WHERE id = ${id} AND account_id = ${accountId}
      RETURNING *;
    `;

    if (result.length === 0) {
      return NextResponse.json({ message: "Variant not found or access denied" }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error: any) {
    console.error("API Variants PUT Error:", error);
    return NextResponse.json(
      { 
        message: "Failed to update variant", 
        error: error.message 
      }, 
      { status: 500 }
    );
  }
}
