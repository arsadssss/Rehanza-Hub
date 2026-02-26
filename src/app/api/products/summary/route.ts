import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ message: "Account not selected" }, { status: 400 });
    }

    const result = await sql`
        SELECT
            COUNT(*) AS total_products,
            COUNT(CASE WHEN stock > 0 THEN 1 END) AS in_stock_products,
            SUM(stock) AS total_inventory_units
        FROM (
            SELECT p.id, COALESCE(SUM(v.stock), 0) as stock
            FROM allproducts p
            LEFT JOIN product_variants v ON p.id = v.product_id
            WHERE p.account_id = ${accountId}
            GROUP BY p.id
        ) as product_stock;
    `;
    
    const stats = result[0];
    const totalProducts = Number(stats.total_products || 0);
    const inStockProducts = Number(stats.in_stock_products || 0);
    const outOfStockProducts = totalProducts - inStockProducts;
    const totalInventoryUnits = Number(stats.total_inventory_units || 0);

    return NextResponse.json({
        totalProducts,
        inStockProducts,
        outOfStockProducts,
        totalInventoryUnits
    });

  } catch (error: any) {
    console.error("API Products Summary Error:", error);
    return NextResponse.json({ message: "Failed to fetch product summary", error: error.message }, { status: 500 });
  }
}
