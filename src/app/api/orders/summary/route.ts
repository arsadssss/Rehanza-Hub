
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) return NextResponse.json({ success: false, message: "Account missing" }, { status: 400 });

    const [globalRes, todayRes] = await Promise.all([
      sql`
        SELECT 
          COUNT(*)::int as total_orders, 
          COALESCE(SUM(total_amount), 0)::numeric as total_revenue
        FROM orders 
        WHERE account_id = ${accountId} AND is_deleted = false
      `,
      sql`
        SELECT 
          COUNT(*)::int as today_orders, 
          COALESCE(SUM(total_amount), 0)::numeric as today_revenue
        FROM orders 
        WHERE account_id = ${accountId} AND is_deleted = false AND DATE(order_date) = CURRENT_DATE
      `
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalOrders: globalRes[0].total_orders,
        totalRevenue: Number(globalRes[0].total_revenue),
        todayOrders: todayRes[0].today_orders,
        todayRevenue: Number(todayRes[0].today_revenue),
      }
    });

  } catch (error: any) {
    console.error("Orders Summary API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
