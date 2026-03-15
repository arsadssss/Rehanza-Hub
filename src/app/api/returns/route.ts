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
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const offset = (page - 1) * limit;
    
    const search = searchParams.get('search');
    const platform = searchParams.get('platform');
    const status = searchParams.get('status');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let whereClauses = ['r.is_deleted = false', 'r.account_id = $1'];
    let params: any[] = [accountId];
    let paramIndex = 2;

    if (platform && platform !== 'all') {
      whereClauses.push(`r.platform = $${paramIndex++}`);
      params.push(platform);
    }

    if (status && status !== 'all') {
      const statusList = status.split(',');
      whereClauses.push(`r.return_type = ANY($${paramIndex++})`);
      params.push(statusList);
    }

    if (search) {
      whereClauses.push(`(r.external_order_id ILIKE $${paramIndex} OR r.external_suborder_id ILIKE $${paramIndex} OR r.awb_number ILIKE $${paramIndex} OR r.sku ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (from) {
      whereClauses.push(`r.return_date >= $${paramIndex++}`);
      params.push(from);
    }

    if (to) {
      whereClauses.push(`r.return_date <= $${paramIndex++}`);
      params.push(to);
    }

    const whereString = `WHERE ${whereClauses.join(' AND ')}`;

    // 1. Get total count
    const countQuery = `
      SELECT COUNT(*)::int as count 
      FROM returns r
      ${whereString}
    `;
    const countResult = await sql(countQuery, params);
    const total = Number(countResult[0]?.count || 0);

    // 2. Get paginated data with SKU join for product names
    const dataQuery = `
      SELECT 
        r.*,
        r.sku as variant_sku,
        p.product_name
      FROM returns r
      LEFT JOIN allproducts p ON LOWER(p.sku) = LOWER(r.sku) AND p.account_id = r.account_id
      ${whereString}
      ORDER BY r.return_date DESC, r.created_at DESC
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
    console.error("API Returns GET Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch returns", error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const accountId = request.headers.get("x-account-id");
        const { external_return_id, return_date, platform, sku, quantity, refund_amount, return_type, return_reason } = body;

        if (!return_date || !platform || !sku || !quantity || !accountId || !return_type || !external_return_id) {
            return NextResponse.json({ message: 'Missing required fields or account' }, { status: 400 });
        }

        const result = await sql`
            INSERT INTO returns (external_return_id, return_date, platform, sku, quantity, refund_amount, return_type, return_reason, account_id, restockable)
            VALUES (${external_return_id}, ${return_date}, ${platform}, ${sku}, ${quantity}, ${refund_amount || 0}, ${return_type}, ${return_reason}, ${accountId}, true)
            RETURNING *;
        `;
        
        return NextResponse.json({ success: true, data: result[0] }, { status: 201 });
    } catch (error: any) {
        console.error("API Returns POST Error:", error);
        return NextResponse.json({ message: 'Failed to create return', error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const accountId = request.headers.get("x-account-id");
        const { id, external_return_id, return_date, platform, sku, quantity, refund_amount, return_type, return_reason } = body;

        if (!id || !accountId) {
            return NextResponse.json({ message: "Return ID and Account are required" }, { status: 400 });
        }

        const result = await sql`
            UPDATE returns
            SET 
                external_return_id = ${external_return_id},
                return_date = ${return_date}, 
                platform = ${platform}, 
                sku = ${sku}, 
                quantity = ${quantity}, 
                refund_amount = ${refund_amount},
                return_type = ${return_type},
                return_reason = ${return_reason}
            WHERE id = ${id} AND account_id = ${accountId}
            RETURNING *;
        `;
        
        if (result.length === 0) {
            return NextResponse.json({ message: 'Return not found or access denied' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: result[0] });
    } catch (error: any) {
        console.error("API Returns PUT Error:", error);
        return NextResponse.json({ message: 'Failed to update return', error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const accountId = request.headers.get("x-account-id");

        if (!id || !accountId) {
            return NextResponse.json({ message: 'Return ID and Account are required' }, { status: 400 });
        }

        const result = await sql`
            UPDATE returns
            SET is_deleted = true
            WHERE id = ${id} AND account_id = ${accountId}
            RETURNING id;
        `;
        
        if (result.length === 0) {
            return NextResponse.json({ message: 'Return not found or access denied' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Return deleted successfully' });
    } catch (error: any) {
        console.error("API Returns DELETE Error:", error);
        return NextResponse.json({ message: 'Failed to delete return', error: error.message }, { status: 500 });
    }
}
