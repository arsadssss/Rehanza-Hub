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
    
    let interval = '7 days';
    let trendGroup = 'day';
    
    if (range === '30d') {
      interval = '30 days';
      trendGroup = 'day';
    } else if (range === '90d') {
      interval = '90 days';
      trendGroup = 'week';
    } else if (range === 'all') {
      interval = '100 years';
      trendGroup = 'month';
    }

    const [
      salesRes,
      ordersCountRes,
      returnsRes,
      totalCostsRes,
      returnLossRes,
      platformRes,
      orderUnitsRes,
      salesTrendRes
    ] = await Promise.all([
      // Total Sales
      sql`SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE account_id = ${accountId} AND is_deleted = false AND (${isAllTime} = true OR order_date >= CURRENT_DATE - ${interval}::interval)`,
      
      // Total Orders Count
      sql`SELECT COUNT(*)::int as count FROM orders WHERE account_id = ${accountId} AND is_deleted = false AND (${isAllTime} = true OR order_date >= CURRENT_DATE - ${interval}::interval)`,
      
      // Total Return Units
      sql`SELECT COALESCE(SUM(quantity), 0)::int as total FROM returns WHERE account_id = ${accountId} AND is_deleted = false AND (${isAllTime} = true OR return_date >= CURRENT_DATE - ${interval}::interval)`,
      
      // Advanced Cost calculation (COGS + Shipping + Fees + Packing + Ads + Tax Misc)
      sql`
        SELECT 
          COALESCE(SUM(
            o.quantity * (
              ap.cost_price + 
              COALESCE(ap.promo_ads, 0) + 
              COALESCE(ap.tax_other, 0) + 
              COALESCE(ap.packing, 0) + 
              (CASE WHEN o.platform = 'Amazon' THEN COALESCE(ap.amazon_ship, 0) ELSE 0 END) +
              (CASE WHEN o.platform = 'Flipkart' THEN COALESCE(ap.flipkart_ship, 0) ELSE 0 END) +
              (CASE WHEN o.platform != 'Meesho' THEN COALESCE(ap.platform_fee, 0) ELSE 0 END)
            )
          ), 0) as total
        FROM orders o
        JOIN product_variants pv ON o.variant_id = pv.id
        JOIN allproducts ap ON pv.product_id = ap.id
        WHERE o.account_id = ${accountId} AND o.is_deleted = false AND (${isAllTime} = true OR o.order_date >= CURRENT_DATE - ${interval}::interval)
      `,
      
      // Total Return Loss
      sql`SELECT COALESCE(SUM(total_loss), 0) as total FROM returns WHERE account_id = ${accountId} AND is_deleted = false AND (${isAllTime} = true OR return_date >= CURRENT_DATE - ${interval}::interval)`,
      
      // Platform Breakdown
      sql`
        SELECT platform, COUNT(*)::int as orders
        FROM orders
        WHERE account_id = ${accountId} AND is_deleted = false AND (${isAllTime} = true OR order_date >= CURRENT_DATE - ${interval}::interval)
        GROUP BY platform
      `,

      // Total Order Units
      sql`SELECT COALESCE(SUM(quantity), 0)::int as total FROM orders WHERE account_id = ${accountId} AND is_deleted = false AND (${isAllTime} = true OR order_date >= CURRENT_DATE - ${interval}::interval)`,

      // Sales Trend
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
    const totalExpenses = Number(totalCostsRes[0]?.total || 0);
    const returnLoss = Number(returnLossRes[0]?.total || 0);
    const netProfit = totalSales - totalExpenses - returnLoss;

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
      }
    });

  } catch (error: any) {
    console.error("Sales Report API Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch report data", error: error.message }, { status: 500 });
  }
}
