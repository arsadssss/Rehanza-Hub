import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * GET /api/analytics/returns
 * Comprehensive Returns Analytics Engine using variant_id based joins.
 */
export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    // 1. Return Rate by SKU (using product_variants)
    const returnRateBySKU = await sql`
      SELECT 
        pv.variant_sku as sku,
        p.product_name,
        COALESCE(ord.qty, 0)::int as sold_qty,
        COALESCE(ret.qty, 0)::int as return_qty,
        ROUND(COALESCE(ret.qty, 0)::numeric / NULLIF(COALESCE(ord.qty, 0), 0) * 100, 2) as return_rate
      FROM product_variants pv
      JOIN allproducts p ON pv.product_id = p.id
      LEFT JOIN (
        SELECT variant_id, SUM(quantity) as qty 
        FROM orders 
        WHERE is_deleted = false AND account_id = ${accountId}
        GROUP BY variant_id
      ) ord ON pv.id = ord.variant_id
      LEFT JOIN (
        SELECT variant_id, SUM(quantity) as qty 
        FROM returns 
        WHERE is_deleted = false AND account_id = ${accountId}
        GROUP BY variant_id
      ) ret ON pv.id = ret.variant_id
      WHERE pv.account_id = ${accountId}
        AND pv.is_deleted = false
        AND p.is_deleted = false
      ORDER BY return_rate DESC NULLS LAST
      LIMIT 50;
    `;

    // 2. RTO vs Customer Return % - LIKE based logic
    const rtoVsCustomer = await sql`
      SELECT 
        CASE 
          WHEN LOWER(status) LIKE '%customer%' THEN 'Customer'
          WHEN LOWER(status) LIKE '%rto%' OR LOWER(status) LIKE '%courier%' OR LOWER(status) LIKE '%undelivered%' THEN 'RTO'
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
        pv.variant_sku as name,
        p.product_name,
        SUM(r.quantity)::int as total_returns,
        SUM(COALESCE(r.refund_amount, 0) + COALESCE(r.shipping_loss, 0) + COALESCE(r.ads_loss, 0) + COALESCE(r.damage_loss, 0))::numeric as total_loss
      FROM returns r
      JOIN product_variants pv ON r.variant_id = pv.id
      JOIN allproducts p ON pv.product_id = p.id
      WHERE r.account_id = ${accountId} AND r.is_deleted = false AND pv.is_deleted = false
      GROUP BY pv.variant_sku, p.product_name
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
