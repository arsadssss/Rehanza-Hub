import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ message: "Account not selected" }, { status: 400 });
    }

    const returns = await sql`
      SELECT r.*, pv.variant_sku
      FROM returns r
      LEFT JOIN product_variants pv ON r.variant_id = pv.id
      WHERE r.is_deleted = false AND r.account_id = ${accountId}
      ORDER BY r.created_at DESC;
    `;
    const formattedData = returns.map(r => ({
        ...r,
        product_variants: {
            variant_sku: r.variant_sku
        }
    }))
    return NextResponse.json(formattedData);
  } catch (error: any) {
    console.error("API Returns GET Error:", error);
    return NextResponse.json({ message: "Failed to fetch returns", error: error.message }, { status: 500 });
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

        const result = await sql`
            INSERT INTO returns (return_date, platform, variant_id, quantity, restockable, shipping_loss, ads_loss, damage_loss, account_id)
            VALUES (${return_date}, ${platform}, ${variant_id}, ${quantity}, ${restockable}, ${shipping_loss}, ${ads_loss}, ${damage_loss}, ${accountId})
            RETURNING *;
        `;
        
        return NextResponse.json(result[0], { status: 201 });
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
                damage_loss = ${damage_loss}
            WHERE id = ${id} AND account_id = ${accountId}
            RETURNING *;
        `;
        
        if (result.length === 0) {
            return NextResponse.json({ message: 'Return not found or access denied' }, { status: 404 });
        }

        return NextResponse.json(result[0]);
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

        return NextResponse.json({ message: 'Return deleted successfully' });
    } catch (error: any) {
        console.error("API Returns DELETE Error:", error);
        return NextResponse.json({ message: 'Failed to delete return', error: error.message }, { status: 500 });
    }
}
