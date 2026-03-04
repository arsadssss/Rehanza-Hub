import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '7d';
    const accountId = request.headers.get("x-account-id");
    
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account not selected" }, { status: 400 });
    }

    const isAllTime = range === 'all';
    
    // Determine interval and grouping for trend based on the range
    let interval = '7 days';
    let trendGroup = 'day';
    
    if (range === '30d') {
      interval = '30 days';
      trendGroup = 'day';
    } else if (range === '90d') {
      interval = '90 days';
      trendGroup = 'week';
    } else if (range === 'all') {
      interval = '100 years'; // Effectively all time
      trendGroup = 'month';
    } else if (range === 'monthly') {
      interval = '30 days';
      trendGroup = 'day';
    } else if (range === 'yearly') {
      interval = '1 year';
      trendGroup = 'month';
    }

    // Parallel dynamic calculations for summary metrics (Scoped by Account AND Date Range)
    const [
      salesRes,
      ordersCountRes,
      returnsRes,
      cogsRes,
      returnLossRes,
      platformRes,
      returnTypeRes,
      platformReturnsRes,
      orderUnitsRes,
      salesTrendRes
    ] = await Promise.all([
      // Total Sales (Revenue) - Scoped
      sql`SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE account_id = ${accountId} AND is_deleted = false AND (${isAllTime} = true OR order_date >= CURRENT_DATE - ${interval}::interval)`,
      
      // Total Orders (Count) - Scoped
      sql`SELECT COUNT(*)::int as count FROM orders WHERE account_id = ${accountId} AND is_deleted = false AND (${isAllTime} = true OR order_date >= CURRENT_DATE - ${interval}::interval)`,
      
      // Total Return Units (Quantity) - Scoped
      sql`SELECT COALESCE(SUM(quantity), 0)::int as total FROM returns WHERE account_id = ${accountId} AND is_deleted = false AND (${isAllTime} = true OR return_date >= CURRENT_DATE - ${interval}::interval)`,
      
      // COGS (Sum of Qty * Cost per Product) - Scoped
      sql`
        SELECT COALESCE(SUM(o.quantity * ap.cost_price), 0) as total
        FROM orders o
        JOIN product_variants pv ON o.variant_id = pv.id
        JOIN allproducts ap ON pv.product_id = ap.id
        WHERE o.account_id = ${accountId} AND o.is_deleted = false AND (${isAllTime} = true OR o.order_date >= CURRENT_DATE - ${interval}::interval)
      `,
      
      // Total Return Loss - Scoped
      sql`SELECT COALESCE(SUM(total_loss), 0) as total FROM returns WHERE account_id = ${accountId} AND is_deleted = false AND (${isAllTime} = true OR return_date >= CURRENT_DATE - ${interval}::interval)`,
      
      // Platform Breakdown for Orders - Scoped
      sql`
        SELECT platform, COUNT(*)::int as orders
        FROM orders
        WHERE account_id = ${accountId} AND is_deleted = false AND (${isAllTime} = true OR order_date >= CURRENT_DATE - ${interval}::interval)
        GROUP BY platform
      `,

      // Return count grouped by return_type - Scoped
      sql`
        SELECT return_type, COUNT(*)::int as count, COALESCE(SUM(quantity), 0)::int as units
        FROM returns
        WHERE account_id = ${accountId} AND is_deleted = false AND (${isAllTime} = true OR return_date >= CURRENT_DATE - ${interval}::interval)
        GROUP BY return_type
      `,

      // Platform-wise return breakdown - Scoped
      sql`
        SELECT platform, COUNT(*)::int as count, COALESCE(SUM(quantity), 0)::int as units
        FROM returns
        WHERE account_id = ${accountId} AND is_deleted = false AND (${isAllTime} = true OR return_date >= CURRENT_DATE - ${interval}::interval)
        GROUP BY platform
      `,

      // Total Order Units - Scoped
      sql`SELECT COALESCE(SUM(quantity), 0)::int as total FROM orders WHERE account_id = ${accountId} AND is_deleted = false AND (${isAllTime} = true OR order_date >= CURRENT_DATE - ${interval}::interval)`,

      // Sales Trend - Scoped
      sql`
        SELECT 
          DATE_TRUNC(${trendGroup}, order_date) as date, 
          SUM(total_amount)::numeric as revenue,
          COUNT(id)::int as orders
        FROM orders 
        WHERE account_id = ${accountId} AND is_deleted = false
          AND (${isAllTime} = true OR order_date >= CURRENT_DATE - ${interval}::interval)
        GROUP BY date
        ORDER BY date ASC
      `
    ]);

    const totalSales = Number(salesRes[0]?.total || 0);
    const totalOrders = Number(ordersCountRes[0]?.count || 0);
    const totalReturnsUnits = Number(returnsRes[0]?.total || 0);
    const totalOrderUnits = Number(orderUnitsRes[0]?.total || 0);
    const cogs = Number(cogsRes[0]?.total || 0);
    const returnLoss = Number(returnLossRes[0]?.total || 0);
    const netProfit = totalSales - cogs - returnLoss;

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
        revenue: Number(row.revenue),
        orders: Number(row.orders)
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
