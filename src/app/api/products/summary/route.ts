
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET() {
  try {
    // Note: We are selecting from `product_variants` and summing their stock,
    // not from `allproducts.stock` which might be out of sync.
    const result = await sql`
        SELECT
            COUNT(*) AS total_products,
            COUNT(CASE WHEN stock > 0 THEN 1 END) AS in_stock_products,
            SUM(stock) AS total_inventory_units
        FROM (
            SELECT p.id, COALESCE(SUM(v.stock), 0) as stock
            FROM allproducts p
            LEFT JOIN product_variants v ON p.id = v.product_id
            GROUP BY p.id
        ) as product_stock;
    `;
    
    const stats = result[0];
    const totalProducts = Number(stats.total_products);
    const inStockProducts = Number(stats.in_stock_products);
    const outOfStockProducts = totalProducts - inStockProducts;
    const totalInventoryUnits = Number(stats.total_inventory_units);

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
