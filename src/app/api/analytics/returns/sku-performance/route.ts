import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * GET /api/analytics/returns/sku-performance
 * Returns SKU-level performance metrics including platform distribution and return rates.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = request.headers.get("x-account-id");
    
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    const platform = searchParams.get('platform');
    const search = searchParams.get('search');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const minRate = searchParams.get('minRate');
    const maxRate = searchParams.get('maxRate');

    // 1. Base Query using CTEs to avoid cartesian product inflation
    const query = `
      WITH variant_platforms AS (
          SELECT variant_id, platform 
          FROM orders 
          WHERE account_id = $1 AND is_deleted = false
          ${from ? `AND order_date >= '${from}'` : ''}
          ${to ? `AND order_date <= '${to}'` : ''}
          UNION
          SELECT variant_id, platform 
          FROM returns 
          WHERE account_id = $1 AND is_deleted = false
          ${from ? `AND return_date >= '${from}'` : ''}
          ${to ? `AND return_date <= '${to}'` : ''}
      ),
      order_stats AS (
          SELECT 
              variant_id, 
              platform, 
              SUM(quantity)::int as total_orders
          FROM orders 
          WHERE account_id = $1 AND is_deleted = false
          ${from ? `AND order_date >= '${from}'` : ''}
          ${to ? `AND order_date <= '${to}'` : ''}
          GROUP BY variant_id, platform
      ),
      return_stats AS (
          SELECT 
              variant_id, 
              platform, 
              SUM(quantity)::int as total_returns,
              SUM(CASE WHEN LOWER(status) IN ('customer return','customer_return','rejected') OR LOWER(return_type) IN ('customer_return','exchange') THEN quantity ELSE 0 END)::int as customer_returns,
              SUM(CASE WHEN LOWER(status) IN ('rto','courier_return','undelivered') OR LOWER(return_type) IN ('rto','dto') THEN quantity ELSE 0 END)::int as rto_returns
          FROM returns
          WHERE account_id = $1 AND is_deleted = false
          ${from ? `AND return_date >= '${from}'` : ''}
          ${to ? `AND return_date <= '${to}'` : ''}
          GROUP BY variant_id, platform
      )
      SELECT 
          pv.variant_sku as sku,
          ap.product_name,
          vp.platform,
          COALESCE(o.total_orders, 0) as total_orders,
          COALESCE(r.total_returns, 0) as total_returns,
          ROUND(COALESCE(r.total_returns, 0)::numeric / NULLIF(COALESCE(o.total_orders, 0), 0) * 100, 2) as return_percent,
          COALESCE(r.customer_returns, 0) as customer_returns,
          COALESCE(r.rto_returns, 0) as rto_returns
      FROM variant_platforms vp
      JOIN product_variants pv ON vp.variant_id = pv.id
      JOIN allproducts ap ON pv.product_id = ap.id
      LEFT JOIN order_stats o ON o.variant_id = vp.variant_id AND o.platform = vp.platform
      LEFT JOIN return_stats r ON r.variant_id = vp.variant_id AND r.platform = vp.platform
      WHERE pv.account_id = $1
        ${platform && platform !== 'all' ? `AND vp.platform = '${platform}'` : ''}
        ${search ? `AND (pv.variant_sku ILIKE '%${search}%' OR ap.product_name ILIKE '%${search}%')` : ''}
      ORDER BY return_percent DESC, total_returns DESC;
    `;

    const result = await sql(query, [accountId]);

    // Apply Rate Filters if specified (Numeric filters in SQL are complex with aliased columns, doing here for safety)
    let filteredData = result;
    if (minRate !== null || maxRate !== null) {
      filteredData = result.filter((row: any) => {
        const rate = Number(row.return_percent || 0);
        const min = minRate ? Number(minRate) : -1;
        const max = maxRate ? Number(maxRate) : 9999;
        return rate >= min && rate <= max;
      });
    }

    return NextResponse.json({
      success: true,
      data: filteredData
    });

  } catch (error: any) {
    console.error("SKU Performance API Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
