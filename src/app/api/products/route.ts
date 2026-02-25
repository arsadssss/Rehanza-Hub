import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

// GET variants for modals
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  try {
    if (type === 'variants') {
        const variants = await sql`
            SELECT v.id, v.variant_sku, v.stock, a.sku as product_sku, a.product_name, a.meesho_price, a.flipkart_price, a.amazon_price
            FROM product_variants v
            JOIN allproducts a ON v.product_id = a.id
            ORDER BY v.variant_sku;
        `;
        return NextResponse.json(variants);
    }
    
    // Default to fetching products for the main product page
    const products = await sql`SELECT id, sku FROM allproducts ORDER BY sku`;
    return NextResponse.json(products);

  } catch (error: any) {
    return NextResponse.json({ message: "Failed to fetch data", error: error.message }, { status: 500 });
  }
}
