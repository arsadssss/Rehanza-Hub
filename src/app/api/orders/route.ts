import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = request.headers.get("x-account-id");
    
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = (page - 1) * limit;
    
    const search = searchParams.get('search');
    const platform = searchParams.get('platform');
    const status = searchParams.get('status');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let whereClauses = ['o.is_deleted = false', 'o.account_id = $1'];
    let params: any[] = [accountId];
    let paramIndex = 2;

    if (platform && platform !== 'all') {
      whereClauses.push(`o.platform = $${paramIndex++}`);
      params.push(platform);
    }

    if (status && status !== 'all') {
      whereClauses.push(`o.status ILIKE $${paramIndex++}`);
      params.push(`%${status}%`);
    }

    if (search) {
      whereClauses.push(`(o.external_order_id ILIKE $${paramIndex} OR pv.variant_sku ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (from) {
      whereClauses.push(`o.order_date >= $${paramIndex++}`);
      params.push(from);
    }

    if (to) {
      whereClauses.push(`o.order_date <= $${paramIndex++}`);
      params.push(to);
    }

    const whereString = `WHERE ${whereClauses.join(' AND ')}`;

    // 1. Get total count for pagination (Filtered)
    const countQuery = `
      SELECT COUNT(*)::int as count 
      FROM orders o
      LEFT JOIN product_variants pv ON pv.id = o.variant_id
      ${whereString}
    `;
    const countResult = await sql(countQuery, params);
    const total = Number(countResult[0]?.count || 0);

    // 2. Get paginated data
    const dataQuery = `
      SELECT 
        o.id,
        o.external_order_id,
        o.order_date,
        o.platform,
        o.quantity,
        o.selling_price,
        o.total_amount,
        o.status,
        pv.variant_sku
      FROM orders o
      LEFT JOIN product_variants pv ON pv.id = o.variant_id
      ${whereString}
      ORDER BY o.order_date DESC, o.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    
    const result = await sql(dataQuery, [...params, limit, offset]);

    return NextResponse.json({
      success: true,
      data: result,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error: any) {
    console.error("API Orders GET Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch orders", error: error.message }, { status: 500 });
  }
}
