import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ message: "Account not selected" }, { status: 400 });
    }

    // Dynamic aggregation from products and variants
    const data = await sql`
      SELECT 
        p.id,
        p.sku,
        p.product_name,
        p.low_stock_threshold,
        COALESCE(SUM(v.stock), 0)::int as total_stock,
        COALESCE(SUM(o.total_amount), 0)::numeric as total_revenue
      FROM allproducts p
      LEFT JOIN product_variants v ON p.id = v.product_id
      LEFT JOIN orders o ON v.id = o.variant_id AND o.is_deleted = false
      WHERE p.account_id = ${accountId}
      GROUP BY p.id, p.sku, p.product_name, p.low_stock_threshold
      ORDER BY p.sku ASC
    `;
    
    const dataWithFormatting = data.map(item => ({
        ...item,
        low_stock_threshold: item.low_stock_threshold || 5,
    }));
    
    return NextResponse.json(dataWithFormatting);
  } catch (error: any) {
    console.error("API Inventory Error:", error);
    return NextResponse.json({ message: "Failed to fetch inventory summary", error: error.message }, { status: 500 });
  }
}
