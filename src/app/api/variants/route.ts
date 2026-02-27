import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;
export const dynamic = "force-dynamic";

/**
 * GET /api/variants
 * Supports server-side pagination, search across multiple fields, and health filtering.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = request.headers.get("x-account-id");

    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    // Pagination params
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = (page - 1) * limit;

    // Filter params
    const search = searchParams.get('search') || '';
    const health = searchParams.get('health') || 'all';
    const productId = searchParams.get('product_id');

    console.log("Variants filters:", { search, health, page, limit, accountId });

    // Build dynamic where clauses
    let whereClauses = ['pv.account_id = $1', 'pv.is_deleted = false'];
    let params: any[] = [accountId];
    let paramIndex = 2;

    // Search filter (SKU, Color, Size, Product Name)
    if (search) {
      whereClauses.push(`(
        pv.variant_sku ILIKE $${paramIndex} OR 
        pv.color ILIKE $${paramIndex} OR 
        pv.size ILIKE $${paramIndex} OR 
        ap.product_name ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Health filter logic
    if (health === 'in_stock') {
      whereClauses.push(`pv.stock > 0`);
    } else if (health === 'out_of_stock') {
      whereClauses.push(`pv.stock = 0`);
    } else if (health === 'low') {
      whereClauses.push(`pv.stock <= pv.low_stock_threshold AND pv.stock > 0`);
    }

    if (productId && productId !== 'all') {
      whereClauses.push(`pv.product_id = $${paramIndex++}`);
      params.push(productId);
    }

    const whereString = `WHERE ${whereClauses.join(' AND ')}`;

    // 1. Fetch total count for pagination
    const countQuery = `
      SELECT COUNT(*) 
      FROM product_variants pv
      JOIN allproducts ap ON pv.product_id = ap.id
      ${whereString}
    `;
    const countRes = await sql(countQuery, params);
    const total = Number(countRes[0]?.count || 0);

    // 2. Fetch paginated data with join
    const dataQuery = `
      SELECT 
        pv.*, 
        ap.product_name, 
        ap.sku as product_sku,
        ap.meesho_price,
        ap.flipkart_price,
        ap.amazon_price
      FROM product_variants pv
      JOIN allproducts ap ON pv.product_id = ap.id
      ${whereString}
      ORDER BY pv.variant_sku ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const data = await sql(dataQuery, params);

    return NextResponse.json({
      success: true,
      data: (data || []).map((v: any) => ({
        ...v,
        stock: Number(v.stock || 0),
        low_stock_threshold: Number(v.low_stock_threshold || 5),
        meesho_price: Number(v.meesho_price || 0),
        flipkart_price: Number(v.flipkart_price || 0),
        amazon_price: Number(v.amazon_price || 0)
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
    return NextResponse.json({ 
      success: false, 
      message: "Failed to fetch variants", 
      error: error.message 
    }, { status: 500 });
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
      AND is_deleted = false
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
      WHERE id = ${id} AND account_id = ${accountId} AND is_deleted = false
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

/**
 * DELETE /api/variants
 * Soft-deletes a variant if not referenced.
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const accountId = request.headers.get("x-account-id");

    if (!id || !accountId) {
      return NextResponse.json({ message: "Variant ID and Account are required" }, { status: 400 });
    }

    // 1. Check if variant is referenced in orders or returns
    const refCheck = await sql`
      SELECT 
        (SELECT COUNT(*) FROM orders WHERE variant_id = ${id} AND is_deleted = false) as order_count,
        (SELECT COUNT(*) FROM returns WHERE variant_id = ${id} AND is_deleted = false) as return_count
    `;

    const orderCount = Number(refCheck[0]?.order_count || 0);
    const returnCount = Number(refCheck[0]?.return_count || 0);

    if (orderCount > 0 || returnCount > 0) {
      return NextResponse.json({ 
        message: `Cannot archive variant. It has ${orderCount} active orders and ${returnCount} active returns.` 
      }, { status: 400 });
    }

    // 2. Perform soft delete
    const result = await sql`
      UPDATE product_variants SET is_deleted = true WHERE id = ${id} AND account_id = ${accountId} RETURNING id;
    `;

    if (result.length === 0) {
      return NextResponse.json({ message: "Variant not found or access denied" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Variant archived successfully." });
  } catch (error: any) {
    console.error("API Variants DELETE Error:", error);
    return NextResponse.json({ message: 'Failed to archive variant', error: error.message }, { status: 500 });
  }
}
