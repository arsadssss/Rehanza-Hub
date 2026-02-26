import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const revalidate = 0;

/**
 * GET /api/wholesale
 * Consolidated endpoint for Wholesale page:
 * 1. Fetches products belonging to account (for dropdown)
 * 2. Fetches wholesale tiers belonging to account (for list)
 */
export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account not selected" }, { status: 400 });
    }

    const [products, tiers] = await Promise.all([
      // 1. Fetch Products for Dropdown
      sql`
        SELECT id, sku, product_name 
        FROM allproducts 
        WHERE account_id = ${accountId} 
        ORDER BY product_name ASC
      `,
      // 2. Fetch Wholesale Tiers with joined data
      sql`
        SELECT 
          wp.id,
          ap.product_name,
          wp.min_quantity,
          wp.wholesale_price,
          u.name AS added_by
        FROM wholesale_prices wp
        JOIN allproducts ap ON wp.product_id = ap.id
        LEFT JOIN users u ON wp.created_by = u.id
        WHERE wp.account_id = ${accountId}
        ORDER BY ap.product_name ASC, wp.min_quantity ASC
      `
    ]);

    return NextResponse.json({
      success: true,
      products: products || [],
      tiers: (tiers || []).map((t: any) => ({
        ...t,
        wholesale_price: Number(t.wholesale_price || 0)
      }))
    });

  } catch (error: any) {
    console.error("Wholesale GET API Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch wholesale data", error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/wholesale
 * Adds a new pricing tier, restricted by account isolation.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const accountId = request.headers.get("x-account-id");
    
    if (!session || !session.user?.id || !accountId) {
      return NextResponse.json({ success: false, message: "Unauthorized or Account missing" }, { status: 401 });
    }

    const body = await request.json();
    const { product_id, min_quantity, wholesale_price } = body;

    if (!product_id || min_quantity === undefined || wholesale_price === undefined) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    // Uniqueness check: (product_id, min_quantity, account_id)
    const existing = await sql`
      SELECT id FROM wholesale_prices 
      WHERE product_id = ${product_id} 
      AND min_quantity = ${min_quantity} 
      AND account_id = ${accountId}
    `;

    if (existing.length > 0) {
      return NextResponse.json({ success: false, message: "A pricing tier for this product and quantity already exists." }, { status: 409 });
    }

    const result = await sql`
      INSERT INTO wholesale_prices (product_id, min_quantity, wholesale_price, created_by, account_id)
      VALUES (${product_id}, ${min_quantity}, ${wholesale_price}, ${session.user.id}, ${accountId})
      RETURNING *;
    `;

    return NextResponse.json({ success: true, message: "Tier added successfully", data: result[0] }, { status: 201 });

  } catch (error: any) {
    console.error("Wholesale POST API Error:", error);
    return NextResponse.json({ success: false, message: "Failed to create tier", error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/wholesale
 * Securely deletes a tier by ID and account_id.
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const accountId = request.headers.get("x-account-id");

    if (!id || !accountId) {
      return NextResponse.json({ success: false, message: "Tier ID and Account required" }, { status: 400 });
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

    return NextResponse.json({ success: true, message: "Tier removed successfully" });

  } catch (error: any) {
    console.error("Wholesale DELETE API Error:", error);
    return NextResponse.json({ success: false, message: "Failed to delete tier", error: error.message }, { status: 500 });
  }
}
