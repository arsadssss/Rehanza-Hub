
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    // Dynamic stats based on account context
    const statsRes = await sql`
      SELECT 
        COUNT(id)::int as total_orders,
        COALESCE(SUM(total_amount), 0)::numeric as total_revenue,
        COUNT(id) FILTER (WHERE order_date = CURRENT_DATE)::int as today_orders,
        COALESCE(SUM(total_amount) FILTER (WHERE order_date = CURRENT_DATE), 0)::numeric as today_revenue
      FROM orders
      WHERE is_deleted = false AND account_id = ${accountId}
    `;

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
