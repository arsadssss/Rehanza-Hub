import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * GET /api/returns/analytics
 * Advanced returns intelligence service.
 * Aggregates loss metrics, SKU performance, and behavioral trends.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = request.headers.get("x-account-id");
    
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    const platform = searchParams.get('platform');
    const skuSearch = searchParams.get('search');
    const from = searchParams.get('from') || '1970-01-01';
    const to = searchParams.get('to') || '9999-12-31';

    // 1. Summary Metrics: Total Returns, RTO vs Customer Return counts
    const summaryRes = await sql`
      SELECT 
        COUNT(*)::int as total_returns,
        COUNT(*) FILTER (WHERE return_type = 'RTO')::int as rto_count,
        COUNT(*) FILTER (WHERE return_type = 'CUSTOMER_RETURN')::int as customer_count
      FROM returns
      WHERE account_id = ${accountId} 
        AND is_deleted = false
        AND return_date >= ${from} 
        AND return_date <= ${to}
        ${platform && platform !== 'all' ? sql`AND platform = ${platform}` : sql``}
    `;

    // 2. Global Order Count for Return Rate calculation
    const ordersRes = await sql`
      SELECT COALESCE(SUM(quantity), 0)::int as total_order_units
      FROM orders
      WHERE account_id = ${accountId} 
        AND is_deleted = false
        AND order_date >= ${from} 
        AND order_date <= ${to}
        ${platform && platform !== 'all' ? sql`AND platform = ${platform}` : sql``}
    `;

    const summaryData = summaryRes[0];
    const totalOrderUnits = Number(ordersRes[0]?.total_order_units || 0);
    const totalReturns = summaryData.total_returns;
    
    const summary = {
      total_returns: totalReturns,
      return_rate: totalOrderUnits > 0 ? Number(((totalReturns / totalOrderUnits) * 100).toFixed(2)) : 0,
      rto_rate: totalReturns > 0 ? Number(((summaryData.rto_count / totalReturns) * 100).toFixed(1)) : 0,
      customer_return_rate: totalReturns > 0 ? Number(((summaryData.customer_count / totalReturns) * 100).toFixed(1)) : 0,
    };

    // 3. SKU Performance: Joins orders and returns to find highest return rates
    // Filters by SKU search if provided
    const skuReturnRate = await sql`
      SELECT 
        pv.variant_sku as sku,
        ap.product_name,
        COALESCE(ord.qty, 0)::int as orders,
        COALESCE(ret.qty, 0)::int as returns,
        CASE 
          WHEN COALESCE(ord.qty, 0) = 0 THEN 0 
          ELSE ROUND((COALESCE(ret.qty, 0)::decimal / ord.qty) * 100, 1) 
        END as return_rate
      FROM product_variants pv
      JOIN allproducts ap ON pv.product_id = ap.id
      LEFT JOIN (
        SELECT variant_id, SUM(quantity) as qty 
        FROM orders 
        WHERE is_deleted = false AND account_id = ${accountId} AND order_date >= ${from} AND order_date <= ${to}
        GROUP BY variant_id
      ) ord ON pv.id = ord.variant_id
      LEFT JOIN (
        SELECT variant_id, SUM(quantity) as qty 
        FROM returns 
        WHERE is_deleted = false AND account_id = ${accountId} AND return_date >= ${from} AND return_date <= ${to}
        GROUP BY variant_id
      ) ret ON pv.id = ret.variant_id
      WHERE pv.account_id = ${accountId}
        ${skuSearch ? sql`AND pv.variant_sku ILIKE ${'%' + skuSearch + '%'}` : sql``}
      ORDER BY return_rate DESC
      LIMIT 10
    `;

    // 4. Worst Products: Top 10 SKUs by raw return count
    const worstProducts = await sql`
      SELECT 
        pv.variant_sku as name,
        COUNT(*)::int as returns
      FROM returns r
      JOIN product_variants pv ON r.variant_id = pv.id
      WHERE r.account_id = ${accountId} 
        AND r.is_deleted = false
        AND r.return_date >= ${from} 
        AND r.return_date <= ${to}
      GROUP BY pv.variant_sku
      ORDER BY returns DESC
      LIMIT 10
    `;

    // 5. Platform Return Loss breakdown
    const platformLoss = await sql`
      SELECT 
        platform,
        COUNT(*)::int as returns,
        SUM(COALESCE(refund_amount, 0) + COALESCE(shipping_loss, 0) + COALESCE(ads_loss, 0) + COALESCE(damage_loss, 0))::numeric as total_loss
      FROM returns
      WHERE account_id = ${accountId} 
        AND is_deleted = false
        AND return_date >= ${from} 
        AND return_date <= ${to}
      GROUP BY platform
      ORDER BY total_loss DESC
    `;

    // 6. Return Trend: Day-by-day distribution
    const returnTrend = await sql`
      SELECT 
        DATE_TRUNC('day', return_date) as date,
        COUNT(*)::int as returns
      FROM returns
      WHERE account_id = ${accountId} 
        AND is_deleted = false
        AND return_date >= ${from} 
        AND return_date <= ${to}
      GROUP BY date
      ORDER BY date ASC
    `;

    return NextResponse.json({
      success: true,
      summary,
      sku_return_rate: skuReturnRate,
      worst_products: worstProducts,
      platform_loss: platformLoss.map((p: any) => ({ ...p, total_loss: Number(p.total_loss) })),
      return_trend: returnTrend.map((t: any) => ({ date: t.date, returns: Number(t.returns) }))
    });

  } catch (error: any) {
    console.error("Returns Intelligence API Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch analytics", error: error.message }, { status: 500 });
  }
}
