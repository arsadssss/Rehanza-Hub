
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

// GET all returns
export async function GET(request: Request) {
  try {
    const returns = await sql`
      SELECT r.*, pv.variant_sku
      FROM returns r
      LEFT JOIN product_variants pv ON r.variant_id = pv.id
      WHERE r.is_deleted = false
      ORDER BY r.created_at DESC;
    `;
    // Manually structure the nested object
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

// POST new return
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { return_date, platform, variant_id, quantity, restockable, shipping_loss, ads_loss, damage_loss } = body;

        if (!return_date || !platform || !variant_id || !quantity) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        const result = await sql`
            INSERT INTO returns (return_date, platform, variant_id, quantity, restockable, shipping_loss, ads_loss, damage_loss)
            VALUES (${return_date}, ${platform}, ${variant_id}, ${quantity}, ${restockable}, ${shipping_loss}, ${ads_loss}, ${damage_loss})
            RETURNING *;
        `;
        
        return NextResponse.json(result[0], { status: 201 });
    } catch (error: any) {
        console.error("API Returns POST Error:", error);
        return NextResponse.json({ message: 'Failed to create return', error: error.message }, { status: 500 });
    }
}

// PUT update return
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, return_date, platform, variant_id, quantity, restockable, shipping_loss, ads_loss, damage_loss } = body;

        if (!id) {
            return NextResponse.json({ message: "Return ID is required" }, { status: 400 });
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
            WHERE id = ${id}
            RETURNING *;
        `;
        
        if (result.length === 0) {
            return NextResponse.json({ message: 'Return not found' }, { status: 404 });
        }

        return NextResponse.json(result[0]);
    } catch (error: any) {
        console.error("API Returns PUT Error:", error);
        return NextResponse.json({ message: 'Failed to update return', error: error.message }, { status: 500 });
    }
}


// DELETE (soft delete) a return
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ message: 'Return ID is required' }, { status: 400 });
        }

        const result = await sql`
            UPDATE returns
            SET is_deleted = true
            WHERE id = ${id}
            RETURNING id;
        `;
        
        if (result.length === 0) {
            return NextResponse.json({ message: 'Return not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Return deleted successfully' });
    } catch (error: any) {
        console.error("API Returns DELETE Error:", error);
        return NextResponse.json({ message: 'Failed to delete return', error: error.message }, { status: 500 });
    }
}
