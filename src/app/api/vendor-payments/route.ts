
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { vendor_id, amount, payment_date, payment_mode, notes } = body;

        if (!vendor_id || !amount || !payment_date || !payment_mode) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        const result = await sql`
            INSERT INTO vendor_payments (vendor_id, amount, payment_date, payment_mode, notes)
            VALUES (${vendor_id}, ${amount}, ${payment_date}, ${payment_mode}, ${notes})
            RETURNING *;
        `;

        return NextResponse.json(result[0], { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ message: 'Failed to create payment', error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, vendor_id, amount, payment_date, payment_mode, notes } = body;

        if (!id) {
            return NextResponse.json({ message: 'ID is required' }, { status: 400 });
        }

        const result = await sql`
            UPDATE vendor_payments
            SET vendor_id = ${vendor_id}, amount = ${amount}, payment_date = ${payment_date}, payment_mode = ${payment_mode}, notes = ${notes}
            WHERE id = ${id}
            RETURNING *;
        `;

        if (result.length === 0) {
            return NextResponse.json({ message: 'Payment not found' }, { status: 404 });
        }

        return NextResponse.json(result[0]);
    } catch (error: any) {
        return NextResponse.json({ message: 'Failed to update payment', error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
        return NextResponse.json({ message: 'ID is required' }, { status: 400 });
    }

    try {
        await sql`UPDATE vendor_payments SET is_deleted = true WHERE id = ${id}`;
        return NextResponse.json({ message: 'Payment deleted' });
    } catch (error: any) {
        return NextResponse.json({ message: 'Failed to delete payment', error: error.message }, { status: 500 });
    }
}
