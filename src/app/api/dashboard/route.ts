import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account not selected" }, { status: 400 });
    }

    const [
      platformRes,
      ordersReturnsRes,
      recentOrdersRes,
      topSellingRes,
      summaryStatsRes,
    ] = await Promise.all([
      // Platform Performance
      sql`
        SELECT 
          platform,
          COALESCE(SUM(quantity), 0)::int as total_units,
          COALESCE(SUM(total_amount), 0)::numeric as total_revenue
        FROM orders
        WHERE is_deleted = false AND account_id = ${accountId}
        GROUP BY platform
      `,
      // Weekly Orders vs Returns
      sql`
        SELECT 
          TO_CHAR(d.date, 'Dy') as day_label,
          COALESCE(COUNT(o.id), 0)::int as total_orders,
          COALESCE(SUM(r.quantity), 0)::int as total_returns
        FROM (
          SELECT CURRENT_DATE - i as date 
          FROM generate_series(0, 6) i
        ) d
        LEFT JOIN orders o ON DATE(o.order_date) = d.date AND o.is_deleted = false AND o.account_id = ${accountId}
        LEFT JOIN returns r ON DATE(r.return_date) = d.date AND r.is_deleted = false AND r.account_id = ${accountId}
        GROUP BY d.date
        ORDER BY d.date ASC
      `,
      // Recent Orders
      sql`
        SELECT o.id, o.created_at, o.platform, o.quantity, o.total_amount, pv.variant_sku, p.product_name
        FROM orders o
        LEFT JOIN product_variants pv ON o.variant_id = pv.id
        LEFT JOIN allproducts p ON pv.product_id = p.id
        WHERE o.is_deleted = false AND o.account_id = ${accountId}
        ORDER BY o.created_at DESC 
        LIMIT 5
      `,
      // Top Selling Products
      sql`
        SELECT 
          p.product_name,
          pv.variant_sku,
          SUM(o.total_amount)::numeric as total_revenue,
          SUM(o.quantity)::int as total_units_sold
        FROM orders o
        JOIN product_variants pv ON o.variant_id = pv.id
        JOIN allproducts p ON pv.product_id = p.id
        WHERE o.is_deleted = false AND o.account_id = ${accountId}
        GROUP BY p.product_name, pv.variant_sku
        ORDER BY total_units_sold DESC
        LIMIT 5
      `,
      // Aggregated Summary
      sql`
        SELECT 
          COALESCE(SUM(quantity), 0)::int as total_units,
          COALESCE(SUM(total_amount), 0)::numeric as gross_revenue
        FROM orders 
        WHERE is_deleted = false AND account_id = ${accountId}
      `
    ]);

    const totalUnitsSold = Number(summaryStatsRes[0]?.total_units || 0);
    const totalReturnsCount = ordersReturnsRes.reduce((acc: number, d: any) => acc + Number(d.total_returns), 0);
    const returnRate = totalUnitsSold > 0 ? (totalReturnsCount / totalUnitsSold) * 100 : 0;

    const summary = {
      total_units: totalUnitsSold,
      gross_revenue: Number(summaryStatsRes[0]?.gross_revenue || 0),
      net_profit: Number(summaryStatsRes[0]?.gross_revenue || 0) * 0.2, // Default 20% margin if not calculated precisely
      return_rate: returnRate,
    };

    return NextResponse.json({
      success: true,
      summary,
      platformPerformance: platformRes.map((p: any) => ({
        platform: p.platform,
        total_units: Number(p.total_units),
        total_revenue: Number(p.total_revenue)
      })),
      ordersReturnsData: ordersReturnsRes.map((d: any) => ({
        ...d,
        total_orders: Number(d.total_orders),
        total_returns: Number(d.total_returns)
      })),
      recentOrders: recentOrdersRes.map((o: any) => ({
        ...o,
        quantity: Number(o.quantity),
        total_amount: Number(o.total_amount)
      })),
      topSellingProducts: topSellingRes.map((p: any) => ({
        ...p,
        total_revenue: Number(p.total_revenue),
        total_units_sold: Number(p.total_units_sold)
      })),
    });

  } catch (error: any) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch dashboard data", error: error.message }, { status: 500 });
  }
}
