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
      platformRes,
      returnTypeRes,
      platformReturnsRes,
      orderUnitsRes
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
      
      // Platform Breakdown for Orders
      sql`
        SELECT platform, COUNT(*)::int as orders
        FROM orders
        WHERE account_id = ${accountId} AND is_deleted = false
        GROUP BY platform
      `,

      // 1. Return count grouped by return_type
      sql`
        SELECT return_type, COUNT(*)::int as count, COALESCE(SUM(quantity), 0)::int as units
        FROM returns
        WHERE account_id = ${accountId} AND is_deleted = false
        GROUP BY return_type
      `,

      // 3. Platform-wise return breakdown
      sql`
        SELECT platform, COUNT(*)::int as count, COALESCE(SUM(quantity), 0)::int as units
        FROM returns
        WHERE account_id = ${accountId} AND is_deleted = false
        GROUP BY platform
      `,

      // Total Order Units (for return percentage calculation)
      sql`SELECT COALESCE(SUM(quantity), 0)::int as total FROM orders WHERE account_id = ${accountId} AND is_deleted = false`
    ]);

    const totalSales = Number(salesRes[0]?.total || 0);
    const totalOrders = Number(ordersCountRes[0]?.count || 0);
    const totalReturnsUnits = Number(returnsRes[0]?.total || 0);
    const totalOrderUnits = Number(orderUnitsRes[0]?.total || 0);
    const cogs = Number(cogsRes[0]?.total || 0);
    const returnLoss = Number(returnLossRes[0]?.total || 0);
    const netProfit = totalSales - cogs - returnLoss;

    // 2. Return percentage relative to total orders (Units ratio)
    const returnRate = totalOrderUnits > 0 ? (totalReturnsUnits / totalOrderUnits) * 100 : 0;

    return NextResponse.json({
      success: true,
      totalSales,
      totalOrders,
      totalReturns: totalReturnsUnits,
      netProfit,
      returnRate: Number(returnRate.toFixed(2)),
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
      },
      returnTypeBreakdown: (returnTypeRes || []).map((row: any) => ({
        type: row.return_type,
        count: row.count,
        units: row.units
      })),
      platformReturns: (platformReturnsRes || []).map((row: any) => ({
        platform: row.platform,
        count: row.count,
        units: row.units
      }))
    });

  } catch (error: any) {
    console.error("Sales Report API Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch report data", error: error.message }, { status: 500 });
  }
}
