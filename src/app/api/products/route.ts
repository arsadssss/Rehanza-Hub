import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * GET /api/products
 * Returns the full dataset of products for the active account.
 */
export async function GET(request: Request) {
  const accountId = request.headers.get("x-account-id");

  if (!accountId) {
    return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
  }

  try {
    const data = await sql`
      SELECT * FROM allproducts 
      WHERE account_id = ${accountId} 
      AND is_deleted = false 
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ 
      success: true,
      data: (data || []).map((p: any) => ({
        ...p,
        cost_price: Number(p.cost_price || 0),
        margin: Number(p.margin || 0),
        meesho_price: Number(p.meesho_price || 0),
        flipkart_price: Number(p.flipkart_price || 0),
        amazon_price: Number(p.amazon_price || 0),
        stock: Number(p.stock || 0)
      }))
    });

  } catch (error: any) {
    console.error("API Products GET Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch products" }, { status: 500 });
  }
}
