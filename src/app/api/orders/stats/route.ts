
import { NextResponse } from 'next/server';
import pool from '@/lib/pg-pool';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    const query = `
      SELECT 
        COUNT(id)::int as total_orders,
        COALESCE(SUM(total_amount), 0)::numeric as total_revenue,
        COUNT(id) FILTER (WHERE order_date = CURRENT_DATE)::int as today_orders,
        COALESCE(SUM(total_amount) FILTER (WHERE order_date = CURRENT_DATE), 0)::numeric as today_revenue
      FROM orders
      WHERE is_deleted = false AND account_id = $1
    `;

    const result = await pool.query(query, [accountId]);
    const stats = result.rows[0];

    return NextResponse.json({
      success: true,
      data: {
        totalOrders: stats.total_orders,
        totalRevenue: Number(stats.total_revenue),
        todayOrders: stats.today_orders,
        todayRevenue: Number(stats.today_revenue)
      }
    });

  } catch (error: any) {
    console.error("API Orders Stats GET Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch stats", error: error.message }, { status: 500 });
  }
}
