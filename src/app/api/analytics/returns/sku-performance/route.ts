import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * GET /api/analytics/returns/sku-performance
 * Returns SKU-level performance metrics by calculating total orders and returns per platform.
 * Synchronizes return quantities directly with the returns table (Return Logs).
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

    // Robust Query using CTEs to ensure Return Quantity matches Return Logs exactly
    const query = `
      WITH sales_summary AS (
          SELECT 
              variant_id, 
              platform,
              SUM(quantity)::int as qty
          FROM orders
          WHERE account_id = $1 AND is_deleted = false
          ${from ? `AND order_date >= '${from}'` : ''}
          ${to ? `AND order_date <= '${to}'` : ''}
          GROUP BY variant_id, platform
      ),
      returns_summary AS (
          SELECT 
              variant_id, 
              platform,
              SUM(quantity)::int as qty,
              SUM(CASE WHEN LOWER(status) LIKE '%customer%' OR LOWER(status) LIKE '%rejected%' OR LOWER(return_type) = 'customer_return' THEN quantity ELSE 0 END)::int AS customer_qty,
              SUM(CASE WHEN LOWER(status) LIKE '%rto%' OR LOWER(status) LIKE '%courier%' OR LOWER(status) LIKE '%undelivered%' OR LOWER(return_type) IN ('rto', 'dto') THEN quantity ELSE 0 END)::int AS rto_qty
          FROM returns
          WHERE account_id = $1 AND is_deleted = false
          ${from ? `AND return_date >= '${from}'` : ''}
          ${to ? `AND return_date <= '${to}'` : ''}
          GROUP BY variant_id, platform
      ),
      combined_stats AS (
          SELECT 
              COALESCE(s.variant_id, r.variant_id) as variant_id,
              COALESCE(s.platform, r.platform) as platform,
              COALESCE(s.qty, 0) as total_orders,
              COALESCE(r.qty, 0) as total_returns,
              COALESCE(r.customer_qty, 0) as customer_returns,
              COALESCE(r.rto_qty, 0) as rto_returns
          FROM sales_summary s
          FULL OUTER JOIN returns_summary r ON s.variant_id = r.variant_id AND s.platform = r.platform
      )
      SELECT 
          pv.variant_sku as sku,
          ap.product_name,
          c.platform,
          c.total_orders,
          c.total_returns,
          ROUND(c.total_returns::numeric / NULLIF(c.total_orders, 0) * 100, 2) as return_percent,
          c.customer_returns,
          c.rto_returns
      FROM combined_stats c
      JOIN product_variants pv ON pv.id = c.variant_id
      JOIN allproducts ap ON ap.id = pv.product_id
      WHERE pv.account_id = $1 AND pv.is_deleted = false
      ${platform && platform !== 'all' ? `AND c.platform = '${platform}'` : ''}
      ${search ? `AND (pv.variant_sku ILIKE '%${search}%' OR ap.product_name ILIKE '%${search}%')` : ''}
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
