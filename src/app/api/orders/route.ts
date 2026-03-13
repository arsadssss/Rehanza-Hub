
import { NextResponse } from 'next/server';
import pool from '@/lib/pg-pool';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = request.headers.get("x-account-id");
    
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    const query = `
      SELECT 
        o.id,
        o.external_order_id,
        o.order_date,
        o.platform,
        o.quantity,
        o.selling_price,
        o.total_amount,
        o.status,
        pv.variant_sku
      FROM orders o
      LEFT JOIN product_variants pv ON pv.id = o.variant_id
      WHERE o.is_deleted = false AND o.account_id = $1
      ORDER BY o.order_date DESC, o.created_at DESC
      LIMIT 100
    `;

    const result = await pool.query(query, [accountId]);

    return NextResponse.json({
      success: true,
      data: result.rows
    });

  } catch (error: any) {
    console.error("API Orders GET Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch orders", error: error.message }, { status: 500 });
  }
}
