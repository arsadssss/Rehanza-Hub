import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * GET /api/analytics/returns
 * Comprehensive Returns Analytics Engine
 * Provides: Return Rate by SKU, RTO vs Customer split, Platform Loss, and Worst Products.
 */
export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    // 1. Return Rate by SKU (CTE for precision quantities)
    const returnRateBySKU = await sql`
      WITH return_agg AS (
        SELECT variant_id, SUM(quantity)::int as return_qty
        FROM returns
        WHERE account_id = ${accountId} AND is_deleted = false
        GROUP BY variant_id
      ),
      order_agg AS (
        SELECT variant_id, SUM(quantity)::int as sold_qty
        FROM orders
        WHERE account_id = ${accountId} AND is_deleted = false
        GROUP BY variant_id
      )
      SELECT 
        pv.variant_sku as sku,
        ap.product_name,
        COALESCE(ra.return_qty, 0) as return_qty,
        COALESCE(oa.sold_qty, 0) as sold_qty,
        ROUND(COALESCE(ra.return_qty, 0)::numeric / NULLIF(COALESCE(oa.sold_qty, 0), 0) * 100, 2) as return_rate
      FROM product_variants pv
      JOIN allproducts ap ON pv.product_id = ap.id
      LEFT JOIN return_agg ra ON ra.variant_id = pv.id
      LEFT JOIN order_agg oa ON oa.variant_id = pv.id
      WHERE pv.account_id = ${accountId} 
        AND (ra.return_qty > 0 OR oa.sold_qty > 0)
      ORDER BY return_rate DESC NULLS LAST
      LIMIT 50;
    `;

    // 2. RTO vs Customer Return %
    const rtoVsCustomer = await sql`
      SELECT 
        CASE 
          WHEN return_type IN ('RTO', 'DTO') THEN 'RTO'
          WHEN return_type IN ('CUSTOMER_RETURN', 'EXCHANGE') THEN 'Customer'
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

    // 4. Worst Products by Returns (Quantity + Loss)
    const worstProducts = await sql`
      SELECT 
        pv.variant_sku as sku,
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
    console.error("Returns Intelligence Dashboard API Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch analytics", error: error.message }, { status: 500 });
  }
}
