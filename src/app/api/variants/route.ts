import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * GET /api/variants
 * Supports server-side pagination, search, and filtering.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = request.headers.get("x-account-id");

    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const search = searchParams.get('search') || '';
    const productId = searchParams.get('product_id');
    const lowStockOnly = searchParams.get('low_stock_only') === 'true';
    const offset = (page - 1) * limit;

    let whereClause = sql`pv.account_id = ${accountId}`;

    if (search) {
      const searchPattern = `%${search}%`;
      whereClause = sql`${whereClause} AND (pv.variant_sku ILIKE ${searchPattern} OR pv.color ILIKE ${searchPattern} OR pv.size ILIKE ${searchPattern})`;
    }

    if (productId && productId !== 'all') {
      whereClause = sql`${whereClause} AND pv.product_id = ${productId}`;
    }

    if (lowStockOnly) {
      whereClause = sql`${whereClause} AND pv.stock <= pv.low_stock_threshold`;
    }

    // 1. Fetch total count
    const countRes = await sql`
      SELECT COUNT(*) FROM product_variants pv 
      WHERE ${whereClause}
    `;
    const total = Number(countRes[0]?.count || 0);

    // 2. Fetch paginated data with join
    const data = await sql`
      SELECT 
        pv.*, 
        ap.product_name, 
        ap.sku as product_sku,
        ap.meesho_price,
        ap.flipkart_price,
        ap.amazon_price
      FROM product_variants pv
      JOIN allproducts ap ON pv.product_id = ap.id
      WHERE ${whereClause}
      ORDER BY pv.variant_sku ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return NextResponse.json({
      success: true,
      data: (data || []).map((v: any) => ({
        ...v,
        stock: Number(v.stock),
        low_stock_threshold: Number(v.low_stock_threshold),
        meesho_price: Number(v.meesho_price),
        flipkart_price: Number(v.flipkart_price),
        amazon_price: Number(v.amazon_price)
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error: any) {
    console.error("API Variants GET Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch variants", error: error.message }, { status: 500 });
  }
}

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
