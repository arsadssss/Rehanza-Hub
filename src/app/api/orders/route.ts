import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * GET /api/orders
 * Returns a filtered list of orders with SKU and Product Name joins.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = request.headers.get("x-account-id");

    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account not selected" }, { status: 400 });
    }

    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    let whereClauses = ['o.is_deleted = false', 'o.account_id = $1'];
    let params: any[] = [accountId];
    let paramIndex = 2;

    if (search) {
      whereClauses.push(`(o.external_order_id ILIKE $${paramIndex} OR pv.variant_sku ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status !== 'all') {
      whereClauses.push(`o.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (fromDate) {
      whereClauses.push(`o.order_date >= $${paramIndex}`);
      params.push(fromDate);
      paramIndex++;
    }

    if (toDate) {
      whereClauses.push(`o.order_date <= $${paramIndex}`);
      params.push(toDate);
      paramIndex++;
    }

    const whereString = `WHERE ${whereClauses.join(' AND ')}`;

    // Fetch Summary Stats
    const statsQuery = `
      SELECT 
        COUNT(*)::int as total_orders,
        COALESCE(SUM(total_amount), 0)::numeric as total_revenue,
        COUNT(*) FILTER (WHERE order_date = CURRENT_DATE)::int as today_orders,
        COALESCE(SUM(total_amount) FILTER (WHERE order_date = CURRENT_DATE), 0)::numeric as today_revenue
      FROM orders o
      ${whereString}
    `;
    const statsRes = await sql(statsQuery, params);

    // Fetch Table Data
    const dataQuery = `
      SELECT 
        o.*,
        pv.variant_sku,
        ap.product_name
      FROM orders o
      LEFT JOIN product_variants pv ON o.variant_id = pv.id
      LEFT JOIN allproducts ap ON pv.product_id = ap.id
      ${whereString}
      ORDER BY o.order_date DESC, o.created_at DESC
    `;
    const orders = await sql(dataQuery, params);

    return NextResponse.json({
      success: true,
      stats: statsRes[0],
      data: orders
    });

  } catch (error: any) {
    console.error("Orders API Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
