import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * GET /api/products
 * Returns a paginated and filtered list of products.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = request.headers.get("x-account-id");

  if (!accountId) {
    return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
  }

  try {
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    let whereClauses = ['account_id = $1', 'is_deleted = false'];
    let params: any[] = [accountId];
    let paramIndex = 2;

    if (search) {
      whereClauses.push(`(sku ILIKE $${paramIndex} OR product_name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereString = `WHERE ${whereClauses.join(' AND ')}`;

    const [data, countResult] = await Promise.all([
      sql(`
        SELECT * FROM allproducts 
        ${whereString} 
        ORDER BY sku ASC 
        LIMIT ${limit} OFFSET ${offset}
      `, params),
      sql(`SELECT COUNT(*) FROM allproducts ${whereString}`, params)
    ]);

    const total = Number(countResult[0]?.count || 0);
    
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
      })), 
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error: any) {
    console.error("API Products GET Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch products" }, { status: 500 });
  }
}
