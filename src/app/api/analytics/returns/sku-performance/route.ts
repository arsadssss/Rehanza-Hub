import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * GET /api/analytics/returns/sku-performance
 * Returns SKU-level performance metrics using variant_id based joins.
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

    // Precision Query using CTEs for independent aggregation
    const query = `
      WITH sales_data AS (
          SELECT 
              variant_id, 
              platform,
              SUM(quantity) as qty
          FROM orders
          WHERE account_id = $1 AND is_deleted = false
          ${from ? `AND order_date >= '${from}'` : ''}
          ${to ? `AND order_date <= '${to}'` : ''}
          GROUP BY variant_id, platform
      ),
      returns_data AS (
          SELECT 
              variant_id, 
              platform,
              SUM(quantity) as qty,
              SUM(CASE WHEN LOWER(status) LIKE '%customer%' OR LOWER(status) LIKE '%rejected%' OR LOWER(return_type) = 'customer_return' THEN quantity ELSE 0 END) AS customer_qty,
              SUM(CASE WHEN LOWER(status) LIKE '%rto%' OR LOWER(status) LIKE '%courier%' OR LOWER(status) LIKE '%undelivered%' OR LOWER(return_type) IN ('rto', 'dto') THEN quantity ELSE 0 END) AS rto_qty
          FROM returns
          WHERE account_id = $1 AND is_deleted = false
          ${from ? `AND return_date >= '${from}'` : ''}
          ${to ? `AND return_date <= '${to}'` : ''}
          GROUP BY variant_id, platform
      )
      SELECT 
          pv.variant_sku as sku,
          ap.product_name,
          COALESCE(s.platform, r.platform) as platform,
          COALESCE(s.qty, 0)::int as total_orders,
          COALESCE(r.qty, 0)::int as total_returns,
          ROUND(COALESCE(r.qty, 0)::numeric / NULLIF(COALESCE(s.qty, 0), 0) * 100, 2) as return_percent,
          COALESCE(r.customer_qty, 0)::int as customer_returns,
          COALESCE(r.rto_qty, 0)::int as rto_returns
      FROM product_variants pv
      JOIN allproducts ap ON ap.id = pv.product_id
      LEFT JOIN sales_data s ON pv.id = s.variant_id
      LEFT JOIN returns_data r ON pv.id = r.variant_id AND (s.platform = r.platform OR s.platform IS NULL OR r.platform IS NULL)
      WHERE pv.account_id = $1 AND pv.is_deleted = false
      ${platform && platform !== 'all' ? `AND (s.platform = '${platform}' OR r.platform = '${platform}')` : ''}
      ${search ? `AND (pv.variant_sku ILIKE '%${search}%' OR ap.product_name ILIKE '%${search}%')` : ''}
      AND (s.qty > 0 OR r.qty > 0)
      ORDER BY return_percent DESC NULLS LAST;
    `;

    const rows = await sql(query, [accountId]);

    // Apply Rate Filters if specified
    let filteredData = rows;
    if (minRate !== null || maxRate !== null) {
      filteredData = rows.filter((row: any) => {
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
