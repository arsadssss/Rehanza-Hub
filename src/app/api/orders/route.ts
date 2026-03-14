
import { NextResponse } from 'next/server';
import pool from '@/lib/pg-pool';

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
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let whereClauses = ['o.is_deleted = false', 'o.account_id = $1'];
    let params: any[] = [accountId];

    if (platform && platform !== 'all') {
      params.push(platform);
      whereClauses.push(`o.platform = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      whereClauses.push(`(o.external_order_id ILIKE $${params.length} OR pv.variant_sku ILIKE $${params.length})`);
    }

    if (from) {
      params.push(from);
      whereClauses.push(`o.order_date >= $${params.length}`);
    }

    if (to) {
      params.push(to);
      whereClauses.push(`o.order_date <= $${params.length}`);
    }

    const whereString = whereClauses.join(' AND ');

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) 
      FROM orders o
      LEFT JOIN product_variants pv ON pv.id = o.variant_id
      WHERE ${whereString}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated data
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
      WHERE ${whereString}
      ORDER BY o.order_date DESC, o.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    
    const finalParams = [...params, limit, offset];
    const result = await pool.query(dataQuery, finalParams);

    return NextResponse.json({
      success: true,
      data: result.rows,
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
