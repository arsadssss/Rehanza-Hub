import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account not selected" }, { status: 400 });
    }

    // 1. Calculate Inventory Investment Value Dynamically
    // Sum of (Variant Stock * Product Cost Price)
    const investmentRes = await sql`
      SELECT COALESCE(SUM(pv.stock * ap.cost_price), 0)::numeric as investment
      FROM product_variants pv
      JOIN allproducts ap ON pv.product_id = ap.id
      WHERE pv.account_id = ${accountId}
    `;
    const inventoryInvestment = Number(investmentRes[0]?.investment || 0);

    // 2. SKU List with Dynamic Performance Stats
    // Aggregates orders and returns on-the-fly per variant
    const items = await sql`
      SELECT 
        pv.id,
        pv.variant_sku as sku,
        ap.product_name as "productName",
        pv.stock,
        COALESCE(pv.low_stock_threshold, 5)::int as "lowStockThreshold",
        COALESCE(ord.total_orders, 0)::int as "totalOrders",
        COALESCE(ret.total_returns, 0)::int as "totalReturns",
        COALESCE(ord.total_revenue, 0)::numeric as "revenue"
      FROM product_variants pv
      JOIN allproducts ap ON pv.product_id = ap.id
      LEFT JOIN (
        SELECT variant_id, SUM(quantity) as total_orders, SUM(total_amount) as total_revenue
        FROM orders
        WHERE is_deleted = false AND account_id = ${accountId}
        GROUP BY variant_id
      ) ord ON pv.id = ord.variant_id
      LEFT JOIN (
        SELECT variant_id, SUM(quantity) as total_returns
        FROM returns
        WHERE is_deleted = false AND account_id = ${accountId}
        GROUP BY variant_id
      ) ret ON pv.id = ret.variant_id
      WHERE pv.account_id = ${accountId}
      ORDER BY ap.product_name ASC, pv.variant_sku ASC
    `;

    return NextResponse.json({
      success: true,
      inventoryInvestment,
      items: (items || []).map((item: any) => ({
        ...item,
        revenue: Number(item.revenue || 0)
      }))
    });
  } catch (error: any) {
    console.error("API Inventory Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch inventory data", error: error.message }, { status: 500 });
  }
}
