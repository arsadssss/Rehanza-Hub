import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = request.headers.get("x-account-id");
    
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    const search = searchParams.get('search');
    const platform = searchParams.get('platform');
    const status = searchParams.get('status');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Build dynamic where clauses consistent with orders list API
    let whereClauses = ['o.is_deleted = false', 'o.account_id = $1'];
    let params: any[] = [accountId];
    let paramIndex = 2;

    if (platform && platform !== 'all') {
      whereClauses.push(`o.platform = $${paramIndex++}`);
      params.push(platform);
    }

    if (status && status !== 'all') {
      whereClauses.push(`o.status ILIKE $${paramIndex++}`);
      params.push(`%${status}%`);
    }

    if (search) {
      whereClauses.push(`(o.external_order_id ILIKE $${paramIndex} OR pv.variant_sku ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (from) {
      whereClauses.push(`o.order_date >= $${paramIndex++}`);
      params.push(from);
    }

    if (to) {
      whereClauses.push(`o.order_date <= $${paramIndex++}`);
      params.push(to);
    }

    const whereString = `WHERE ${whereClauses.join(' AND ')}`;

    // Calculate stats based on filtered results
    const statsRes = await sql(`
      SELECT 
        COUNT(o.id)::int as total_orders,
        COALESCE(SUM(o.total_amount), 0)::numeric as total_revenue,
        COUNT(o.id) FILTER (WHERE o.order_date = CURRENT_DATE)::int as today_orders,
        COALESCE(SUM(o.total_amount) FILTER (WHERE o.order_date = CURRENT_DATE), 0)::numeric as today_revenue
      FROM orders o
      LEFT JOIN product_variants pv ON pv.id = o.variant_id
      ${whereString}
    `, params);

    const stats = statsRes[0];

    return NextResponse.json({
      success: true,
      data: {
        totalOrders: Number(stats.total_orders || 0),
        totalRevenue: Number(stats.total_revenue || 0),
        todayOrders: Number(stats.today_orders || 0),
        todayRevenue: Number(stats.today_revenue || 0)
      }
    });

  } catch (error: any) {
    console.error("API Orders Stats GET Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch stats", error: error.message }, { status: 500 });
  }
}
