import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account not selected" }, { status: 400 });
    }

    // 1. Fetch all raw data in parallel using Promise.all for speed
    const [
      orderSummary,
      returnSummary,
      productCosts,
      platformStats,
      weeklyTrend,
      recentOrdersRes,
      topSellingRes,
    ] = await Promise.all([
      // Total Units and Gross Revenue
      sql`
        SELECT 
          COALESCE(SUM(quantity), 0)::int as total_units,
          COALESCE(SUM(total_amount), 0)::numeric as gross_revenue
        FROM orders 
        WHERE account_id = ${accountId} AND is_deleted = false
      `,
      // Total Return Units and Total Return Loss
      sql`
        SELECT 
          COALESCE(SUM(quantity), 0)::int as return_units,
          COALESCE(SUM(total_loss), 0)::numeric as return_loss
        FROM returns 
        WHERE account_id = ${accountId} AND is_deleted = false
      `,
      // Total Cost of Goods Sold (for Net Profit)
      sql`
        SELECT SUM(o.quantity * p.cost_price)::numeric as total_cost
        FROM orders o
        JOIN product_variants pv ON o.variant_id = pv.id
        JOIN allproducts p ON pv.product_id = p.id
        WHERE o.account_id = ${accountId} AND o.is_deleted = false
      `,
      // Platform Performance Breakdown
      sql`
        SELECT 
          platform,
          COALESCE(SUM(quantity), 0)::int as total_units,
          COALESCE(SUM(total_amount), 0)::numeric as total_revenue
        FROM orders
        WHERE account_id = ${accountId} AND is_deleted = false
        GROUP BY platform
      `,
      // Weekly Trend (Last 7 Days)
      sql`
        SELECT 
          TO_CHAR(d.date, 'Dy') as day_label,
          COALESCE(COUNT(o.id), 0)::int as total_orders,
          COALESCE(SUM(r.quantity), 0)::int as total_returns
        FROM (
          SELECT CURRENT_DATE - i as date 
          FROM generate_series(0, 6) i
        ) d
        LEFT JOIN orders o ON DATE(o.order_date) = d.date AND o.account_id = ${accountId} AND o.is_deleted = false
        LEFT JOIN returns r ON DATE(r.return_date) = d.date AND r.account_id = ${accountId} AND r.is_deleted = false
        GROUP BY d.date
        ORDER BY d.date ASC
      `,
      // Recent Orders (Latest 5)
      sql`
        SELECT o.id, o.created_at, o.platform, o.quantity, o.total_amount, pv.variant_sku, p.product_name, o.order_date
        FROM orders o
        LEFT JOIN product_variants pv ON o.variant_id = pv.id
        LEFT JOIN allproducts p ON pv.product_id = p.id
        WHERE o.account_id = ${accountId} AND o.is_deleted = false
        ORDER BY o.order_date DESC, o.created_at DESC 
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
        WHERE o.account_id = ${accountId} AND o.is_deleted = false
        GROUP BY p.product_name, pv.variant_sku
        ORDER BY total_units_sold DESC
        LIMIT 5
      `
    ]);

    // 2. Perform Secondary Calculations
    const unitsSold = Number(orderSummary[0]?.total_units || 0);
    const revenue = Number(orderSummary[0]?.gross_revenue || 0);
    const returnUnits = Number(returnSummary[0]?.return_units || 0);
    const returnLoss = Number(returnSummary[0]?.return_loss || 0);
    const cogs = Number(productCosts[0]?.total_cost || 0);

    const netProfit = revenue - cogs - returnLoss;
    const returnRate = unitsSold > 0 ? (returnUnits / unitsSold) * 100 : 0;

    const summary = {
      total_units: unitsSold,
      gross_revenue: revenue,
      net_profit: netProfit,
      return_rate: returnRate,
    };

    return NextResponse.json({
      success: true,
      summary,
      platformPerformance: platformStats.map((p: any) => ({
        platform: p.platform,
        total_units: Number(p.total_units),
        total_revenue: Number(p.total_revenue)
      })),
      ordersReturnsData: weeklyTrend.map((d: any) => ({
        day_label: d.day_label,
        total_orders: Number(d.total_orders),
        total_returns: Number(d.total_returns)
      })),
      recentOrders: recentOrdersRes.map((o: any) => ({
        ...o,
        quantity: Number(o.quantity),
        total_amount: Number(o.total_amount),
        created_at: o.order_date // Consistent with list display
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
