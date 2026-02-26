import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account not selected" }, { status: 400 });
    }

    // 1. Parallel dynamic calculations from raw tables
    const [
      salesRes,
      ordersCountRes,
      returnsRes,
      cogsRes,
      returnLossRes,
      salesTrendRes,
      platformRes
    ] = await Promise.all([
      // Total Sales (Revenue)
      sql`SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE account_id = ${accountId} AND is_deleted = false`,
      
      // Total Orders (Count)
      sql`SELECT COUNT(*)::int as count FROM orders WHERE account_id = ${accountId} AND is_deleted = false`,
      
      // Total Return Units (Quantity)
      sql`SELECT COALESCE(SUM(quantity), 0)::int as total FROM returns WHERE account_id = ${accountId} AND is_deleted = false`,
      
      // COGS (Sum of Qty * Cost per Product)
      sql`
        SELECT COALESCE(SUM(o.quantity * ap.cost_price), 0) as total
        FROM orders o
        JOIN product_variants pv ON o.variant_id = pv.id
        JOIN allproducts ap ON pv.product_id = ap.id
        WHERE o.account_id = ${accountId} AND o.is_deleted = false
      `,
      
      // Total Return Loss (Aggregated damage/shipping losses)
      sql`SELECT COALESCE(SUM(total_loss), 0) as total FROM returns WHERE account_id = ${accountId} AND is_deleted = false`,
      
      // Daily Sales Trend
      sql`
        SELECT 
          DATE(order_date) as date, 
          SUM(total_amount)::numeric as revenue
        FROM orders 
        WHERE account_id = ${accountId} AND is_deleted = false
        GROUP BY DATE(order_date)
        ORDER BY date ASC
      `,
      
      // Platform Breakdown for Pie Chart
      sql`
        SELECT platform, COUNT(*)::int as orders
        FROM orders
        WHERE account_id = ${accountId} AND is_deleted = false
        GROUP BY platform
      `
    ]);

    const totalSales = Number(salesRes[0]?.total || 0);
    const totalOrders = Number(ordersCountRes[0]?.count || 0);
    const totalReturns = Number(returnsRes[0]?.total || 0);
    const cogs = Number(cogsRes[0]?.total || 0);
    const returnLoss = Number(returnLossRes[0]?.total || 0);
    const netProfit = totalSales - cogs - returnLoss;

    return NextResponse.json({
      success: true,
      totalSales,
      totalOrders,
      totalReturns,
      netProfit,
      salesTrend: (salesTrendRes || []).map((row: any) => ({
        date: row.date,
        revenue: Number(row.revenue)
      })),
      platformOrders: {
        totalOrders,
        breakdown: (platformRes || []).map((row: any) => ({
          platform: row.platform,
          orders: Number(row.orders)
        }))
      }
    });

  } catch (error: any) {
    console.error("Sales Report API Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch report data", error: error.message }, { status: 500 });
  }
}
