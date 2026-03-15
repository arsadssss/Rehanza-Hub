import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * GET /api/analytics/returns
 * Comprehensive Returns Analytics Engine.
 * Aggregates summary stats, behavioral splits, and platform losses.
 */
export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    // 1. Return Rate by SKU (Aggregated by Variant SKU)
    const returnRateBySKU = await sql`
      WITH variant_sales AS (
        SELECT variant_id, SUM(quantity) as sold_qty
        FROM orders
        WHERE account_id = ${accountId} AND is_deleted = false
        GROUP BY variant_id
      ),
      variant_returns AS (
        SELECT variant_id, SUM(quantity) as return_qty
        FROM returns
        WHERE account_id = ${accountId} AND is_deleted = false
        GROUP BY variant_id
      )
      SELECT 
        pv.variant_sku as sku,
        ap.product_name,
        COALESCE(vs.sold_qty, 0)::int as sold_qty,
        COALESCE(vr.return_qty, 0)::int as return_qty,
        ROUND(COALESCE(vr.return_qty, 0)::numeric / NULLIF(COALESCE(vs.sold_qty, 0), 0) * 100, 2) as return_rate
      FROM product_variants pv
      JOIN allproducts ap ON pv.product_id = ap.id
      LEFT JOIN variant_sales vs ON pv.id = vs.variant_id
      LEFT JOIN variant_returns vr ON pv.id = vr.variant_id
      WHERE pv.account_id = ${accountId} 
        AND pv.is_deleted = false
        AND (vs.sold_qty > 0 OR vr.return_qty > 0)
      ORDER BY return_rate DESC NULLS LAST
      LIMIT 20;
    `;

    // 2. RTO vs Customer Return % - Precise Mapping
    const rtoVsCustomer = await sql`
      SELECT 
        CASE 
          WHEN LOWER(status) LIKE '%customer%' OR LOWER(status) LIKE '%rejected%' OR LOWER(return_type) = 'customer_return' THEN 'Customer'
          WHEN LOWER(status) LIKE '%rto%' OR LOWER(status) LIKE '%courier%' OR LOWER(status) LIKE '%undelivered%' OR LOWER(return_type) IN ('rto', 'dto') THEN 'RTO'
          ELSE 'Other'
        END as label,
        SUM(quantity)::int as value
      FROM returns
      WHERE account_id = ${accountId} AND is_deleted = false
      GROUP BY label;
    `;

    // 3. Platform-wise Return Loss
    const platformLoss = await sql`
      SELECT
        platform,
        COUNT(*)::int as return_count,
        SUM(COALESCE(refund_amount, 0) + COALESCE(shipping_loss, 0) + COALESCE(ads_loss, 0) + COALESCE(damage_loss, 0))::numeric AS total_loss
      FROM returns
      WHERE account_id = ${accountId} AND is_deleted = false
      GROUP BY platform
      ORDER BY total_loss DESC;
    `;

    // 4. Worst Products by Returns (Quantity + Loss) - Grouped by Variant
    const worstProducts = await sql`
      SELECT 
        pv.variant_sku as name,
        ap.product_name,
        SUM(r.quantity)::int as total_returns,
        SUM(COALESCE(r.refund_amount, 0) + COALESCE(r.shipping_loss, 0) + COALESCE(r.ads_loss, 0) + COALESCE(r.damage_loss, 0))::numeric as total_loss
      FROM returns r
      JOIN product_variants pv ON r.variant_id = pv.id
      JOIN allproducts ap ON pv.product_id = ap.id
      WHERE r.account_id = ${accountId} AND r.is_deleted = false
      GROUP BY pv.variant_sku, ap.product_name
      ORDER BY total_returns DESC
      LIMIT 10;
    `;

    return NextResponse.json({
      success: true,
      returnRateBySKU,
      rtoVsCustomer,
      platformLoss: platformLoss.map((p: any) => ({ ...p, total_loss: Number(p.total_loss) })),
      worstProducts: worstProducts.map((p: any) => ({ ...p, total_loss: Number(p.total_loss) }))
    });

  } catch (error: any) {
    console.error("Returns Intelligence API Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch analytics", error: error.message }, { status: 500 });
  }
}
