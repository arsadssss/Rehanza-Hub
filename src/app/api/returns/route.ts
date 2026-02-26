import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = request.headers.get("x-account-id");

    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const offset = (page - 1) * pageSize;

    // Filters
    const platform = searchParams.get('platform');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const search = searchParams.get('search');

    let whereClauses = ['r.is_deleted = false', 'r.account_id = $1'];
    let params: any[] = [accountId];
    let paramIndex = 2;

    if (platform && platform !== 'all') {
      whereClauses.push(`r.platform = $${paramIndex++}`);
      params.push(platform);
    }
    if (fromDate) {
      whereClauses.push(`r.return_date >= $${paramIndex++}`);
      params.push(fromDate);
    }
    if (toDate) {
      whereClauses.push(`r.return_date <= $${paramIndex++}`);
      params.push(toDate);
    }
    if (search) {
      whereClauses.push(`(pv.variant_sku ILIKE $${paramIndex} OR ap.product_name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereString = `WHERE ${whereClauses.join(' AND ')}`;

    // 1. Count
    const countQuery = `
      SELECT COUNT(*) 
      FROM returns r
      JOIN product_variants pv ON r.variant_id = pv.id
      JOIN allproducts ap ON pv.product_id = ap.id
      ${whereString}
    `;
    const countResult = await sql(countQuery, params);
    const totalRows = Number(countResult[0]?.count || 0);

    // 2. Data
    const dataQuery = `
      SELECT 
        r.*, 
        pv.variant_sku,
        ap.product_name
      FROM returns r
      JOIN product_variants pv ON r.variant_id = pv.id
      JOIN allproducts ap ON pv.product_id = ap.id
      ${whereString}
      ORDER BY r.return_date DESC, r.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset};
    `;
    const returns = await sql(dataQuery, params);

    return NextResponse.json({
      success: true,
      data: returns.map((r: any) => ({
        ...r,
        quantity: Number(r.quantity),
        total_loss: Number(r.total_loss || 0),
        product_variants: { variant_sku: r.variant_sku }
      })),
      totalRows,
      page,
      pageSize
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
        const { return_date, platform, variant_id, quantity, restockable, shipping_loss, ads_loss, damage_loss } = body;

        if (!return_date || !platform || !variant_id || !quantity || !accountId) {
            return NextResponse.json({ message: 'Missing required fields or account' }, { status: 400 });
        }

        const total_loss = Number(shipping_loss || 0) + Number(ads_loss || 0) + Number(damage_loss || 0);

        const result = await sql`
            INSERT INTO returns (return_date, platform, variant_id, quantity, restockable, shipping_loss, ads_loss, damage_loss, total_loss, account_id)
            VALUES (${return_date}, ${platform}, ${variant_id}, ${quantity}, ${restockable}, ${shipping_loss}, ${ads_loss}, ${damage_loss}, ${total_loss}, ${accountId})
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
        const { id, return_date, platform, variant_id, quantity, restockable, shipping_loss, ads_loss, damage_loss } = body;

        if (!id || !accountId) {
            return NextResponse.json({ message: "Return ID and Account are required" }, { status: 400 });
        }

        const total_loss = Number(shipping_loss || 0) + Number(ads_loss || 0) + Number(damage_loss || 0);

        const result = await sql`
            UPDATE returns
            SET 
                return_date = ${return_date}, 
                platform = ${platform}, 
                variant_id = ${variant_id}, 
                quantity = ${quantity}, 
                restockable = ${restockable},
                shipping_loss = ${shipping_loss},
                ads_loss = ${ads_loss},
                damage_loss = ${damage_loss},
                total_loss = ${total_loss}
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
