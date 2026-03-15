import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * GET /api/analytics/returns/sku-performance
 * Returns SKU-level performance metrics using variant_id based joins.
 * Resolves SKU from product_variants table.
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

    // Query adapted to join on product_variants to resolve SKU and join with returns on variant_id
    const query = `
      SELECT
        pv.variant_sku AS sku,
        ap.product_name,
        o.platform,
        SUM(o.quantity)::int AS total_orders,
        COALESCE(r.total_returns, 0)::int AS total_returns,
        ROUND(
          COALESCE(r.total_returns, 0)::numeric / NULLIF(SUM(o.quantity), 0) * 100,
          2
        ) AS return_percent,
        COALESCE(r.customer_returns, 0)::int AS customer_returns,
        COALESCE(r.rto_returns, 0)::int AS rto_returns
      FROM orders o
      JOIN product_variants pv ON pv.id = o.variant_id
      JOIN allproducts ap ON ap.id = pv.product_id
      LEFT JOIN (
          SELECT
            variant_id,
            account_id,
            SUM(quantity) AS total_returns,
            SUM(CASE WHEN LOWER(status) LIKE '%customer%' THEN quantity ELSE 0 END) AS customer_returns,
            SUM(CASE WHEN LOWER(status) LIKE '%rto%' OR LOWER(status) LIKE '%courier%' OR LOWER(status) LIKE '%undelivered%' THEN quantity ELSE 0 END) AS rto_returns
          FROM returns
          WHERE is_deleted = false
          ${from ? `AND return_date >= '${from}'` : ''}
          ${to ? `AND return_date <= '${to}'` : ''}
          GROUP BY variant_id, account_id
      ) r ON o.variant_id = r.variant_id AND r.account_id = o.account_id
      WHERE o.account_id = $1
        AND o.is_deleted = false
        AND ap.is_deleted = false
        ${platform && platform !== 'all' ? `AND o.platform = '${platform}'` : ''}
        ${search ? `AND (pv.variant_sku ILIKE '%${search}%' OR ap.product_name ILIKE '%${search}%')` : ''}
        ${from ? `AND o.order_date >= '${from}'` : ''}
        ${to ? `AND o.order_date <= '${to}'` : ''}
      GROUP BY
        pv.variant_sku,
        ap.product_name,
        o.platform,
        r.total_returns,
        r.customer_returns,
        r.rto_returns
      ORDER BY return_percent DESC;
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
