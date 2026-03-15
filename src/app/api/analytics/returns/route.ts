import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * GET /api/analytics/returns
 * Comprehensive Returns Analytics Engine using variant based joins for orders.
 */
export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    // 1. Return Rate by SKU (resolving SKU from orders via product_variants)
    const returnRateBySKU = await sql`
      SELECT 
        p.sku,
        p.product_name,
        COALESCE(ord.qty, 0)::int as sold_qty,
        COALESCE(ret.qty, 0)::int as return_qty,
        ROUND(COALESCE(ret.qty, 0)::numeric / NULLIF(COALESCE(ord.qty, 0), 0) * 100, 2) as return_rate
      FROM allproducts p
      LEFT JOIN (
        SELECT LOWER(pv.variant_sku) as sku, SUM(o.quantity) as qty 
        FROM orders o
        JOIN product_variants pv ON o.variant_id = pv.id
        WHERE o.is_deleted = false AND o.account_id = ${accountId}
        GROUP BY LOWER(pv.variant_sku)
      ) ord ON LOWER(p.sku) = ord.sku
      LEFT JOIN (
        SELECT LOWER(sku) as sku, SUM(quantity) as qty 
        FROM returns 
        WHERE is_deleted = false AND account_id = ${accountId}
        GROUP BY LOWER(sku)
      ) ret ON LOWER(p.sku) = ret.sku
      WHERE p.account_id = ${accountId}
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
        p.sku as name,
        p.product_name,
        SUM(r.quantity)::int as total_returns,
        SUM(COALESCE(r.refund_amount, 0) + COALESCE(r.shipping_loss, 0) + COALESCE(r.ads_loss, 0) + COALESCE(r.damage_loss, 0))::numeric as total_loss
      FROM returns r
      JOIN allproducts p ON LOWER(r.sku) = LOWER(p.sku)
      WHERE r.account_id = ${accountId} AND r.is_deleted = false AND p.is_deleted = false
      GROUP BY p.sku, p.product_name
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
