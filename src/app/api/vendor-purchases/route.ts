
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { vendor_id, product_name, quantity, cost_per_unit, purchase_date, description } = body;
        
        if (!vendor_id || !product_name || !quantity || !cost_per_unit || !purchase_date) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        const result = await sql`
            INSERT INTO vendor_purchases (vendor_id, product_name, quantity, cost_per_unit, purchase_date, description)
            VALUES (${vendor_id}, ${product_name}, ${quantity}, ${cost_per_unit}, ${purchase_date}, ${description})
            RETURNING *;
        `;
        
        return NextResponse.json(result[0], { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ message: 'Failed to create purchase', error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, vendor_id, product_name, quantity, cost_per_unit, purchase_date, description } = body;
        
        if (!id) {
            return NextResponse.json({ message: 'ID is required' }, { status: 400 });
        }

        const result = await sql`
            UPDATE vendor_purchases
            SET vendor_id = ${vendor_id}, product_name = ${product_name}, quantity = ${quantity}, cost_per_unit = ${cost_per_unit}, purchase_date = ${purchase_date}, description = ${description}
            WHERE id = ${id}
            RETURNING *;
        `;

        if (result.length === 0) {
            return NextResponse.json({ message: 'Purchase not found' }, { status: 404 });
        }
        
        return NextResponse.json(result[0]);
    } catch (error: any) {
        return NextResponse.json({ message: 'Failed to update purchase', error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
        return NextResponse.json({ message: 'ID is required' }, { status: 400 });
    }

    try {
        await sql`UPDATE vendor_purchases SET is_deleted = true WHERE id = ${id}`;
        return NextResponse.json({ message: 'Purchase deleted' });
    } catch (error: any) {
        return NextResponse.json({ message: 'Failed to delete purchase', error: error.message }, { status: 500 });
    }
}
