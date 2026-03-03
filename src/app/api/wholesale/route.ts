import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const revalidate = 0;

/**
 * GET /api/wholesale
 * Returns all wholesale pricing tiers for the active account with search and sort.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = request.headers.get("x-account-id");
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'latest';

    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    let orderBy = 'created_at DESC';
    switch (sort) {
      case 'price_asc': orderBy = 'wholesale_price ASC'; break;
      case 'price_desc': orderBy = 'wholesale_price DESC'; break;
      case 'qty_desc': orderBy = 'min_quantity DESC'; break;
      case 'latest': default: orderBy = 'created_at DESC'; break;
    }

    const tiers = await sql`
      SELECT 
        id, 
        product_name, 
        min_quantity, 
        wholesale_price, 
        (SELECT name FROM users WHERE id = created_by) as added_by,
        created_at
      FROM wholesale_prices
      WHERE account_id = ${accountId}
      AND (product_name ILIKE ${'%' + search + '%'})
      ORDER BY ${sql.raw(orderBy)}
    `;

    return NextResponse.json({
      success: true,
      tiers: (tiers || []).map((t: any) => ({
        ...t,
        wholesale_price: Number(t.wholesale_price || 0)
      }))
    });

  } catch (error: any) {
    console.error("Wholesale GET API Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch wholesale data" }, { status: 500 });
  }
}

/**
 * POST /api/wholesale
 * Creates a new wholesale tier.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const accountId = request.headers.get("x-account-id");
    
    if (!session || !session.user?.id || !accountId) {
      return NextResponse.json({ success: false, message: "Unauthorized access" }, { status: 401 });
    }

    const body = await request.json();
    const { product_name, min_quantity, wholesale_price } = body;

    if (!product_name || product_name.trim() === "") {
      return NextResponse.json({ success: false, message: "Product name is required" }, { status: 400 });
    }
    if (min_quantity === undefined || Number(min_quantity) <= 0) {
      return NextResponse.json({ success: false, message: "Minimum quantity must be greater than 0" }, { status: 400 });
    }
    if (wholesale_price === undefined || Number(wholesale_price) <= 0) {
      return NextResponse.json({ success: false, message: "Wholesale price must be greater than 0" }, { status: 400 });
    }

    const existing = await sql`
      SELECT id FROM wholesale_prices 
      WHERE account_id = ${accountId} 
      AND LOWER(product_name) = LOWER(${product_name.trim()}) 
      AND min_quantity = ${min_quantity}
    `;

    if (existing.length > 0) {
      return NextResponse.json({ success: false, message: "Duplicate tier for this product and quantity" }, { status: 409 });
    }

    const result = await sql`
      INSERT INTO wholesale_prices (product_name, min_quantity, wholesale_price, account_id, created_by)
      VALUES (${product_name.trim()}, ${min_quantity}, ${wholesale_price}, ${accountId}, ${session.user.id})
      RETURNING *;
    `;

    return NextResponse.json({ success: true, data: result[0] }, { status: 201 });

  } catch (error: any) {
    console.error("Wholesale POST API Error:", error);
    return NextResponse.json({ success: false, message: "Failed to create wholesale tier" }, { status: 500 });
  }
}

/**
 * PUT /api/wholesale
 * Updates an existing wholesale tier.
 */
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const accountId = request.headers.get("x-account-id");
    
    if (!session || !session.user?.id || !accountId) {
      return NextResponse.json({ success: false, message: "Unauthorized access" }, { status: 401 });
    }

    const body = await request.json();
    const { id, product_name, min_quantity, wholesale_price } = body;

    if (!id || !product_name || Number(min_quantity) <= 0 || Number(wholesale_price) <= 0) {
      return NextResponse.json({ success: false, message: "Invalid update data" }, { status: 400 });
    }

    const result = await sql`
      UPDATE wholesale_prices
      SET 
        product_name = ${product_name.trim()},
        min_quantity = ${min_quantity},
        wholesale_price = ${wholesale_price},
        updated_at = NOW()
      WHERE id = ${id} AND account_id = ${accountId}
      RETURNING *;
    `;

    if (result.length === 0) {
      return NextResponse.json({ success: false, message: "Tier not found or access denied" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result[0] });

  } catch (error: any) {
    console.error("Wholesale PUT API Error:", error);
    return NextResponse.json({ success: false, message: "Failed to update wholesale tier" }, { status: 500 });
  }
}

/**
 * DELETE /api/wholesale
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const accountId = request.headers.get("x-account-id");

    if (!id || !accountId) {
      return NextResponse.json({ success: false, message: "ID and Account context required" }, { status: 400 });
    }

    const result = await sql`
      DELETE FROM wholesale_prices 
      WHERE id = ${id} 
      AND account_id = ${accountId}
      RETURNING id;
    `;

    if (result.length === 0) {
      return NextResponse.json({ success: false, message: "Tier not found or access denied" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Wholesale tier deleted successfully" });

  } catch (error: any) {
    console.error("Wholesale DELETE API Error:", error);
    return NextResponse.json({ success: false, message: "Failed to delete tier" }, { status: 500 });
  }
}