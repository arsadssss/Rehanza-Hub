import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const accountId = request.headers.get("x-account-id");
        const { vendor_id, amount, payment_date, payment_mode, notes } = body;

        if (!vendor_id || !amount || !payment_date || !payment_mode || !accountId) {
            return NextResponse.json({ message: 'Missing required fields or account' }, { status: 400 });
        }

        const result = await sql`
            INSERT INTO vendor_payments (vendor_id, amount, payment_date, payment_mode, notes, account_id)
            VALUES (${vendor_id}, ${amount}, ${payment_date}, ${payment_mode}, ${notes}, ${accountId})
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
        const accountId = request.headers.get("x-account-id");
        const { id, vendor_id, amount, payment_date, payment_mode, notes } = body;

        if (!id || !accountId) {
            return NextResponse.json({ message: 'ID and Account are required' }, { status: 400 });
        }

        const result = await sql`
            UPDATE vendor_payments
            SET vendor_id = ${vendor_id}, amount = ${amount}, payment_date = ${payment_date}, payment_mode = ${payment_mode}, notes = ${notes}
            WHERE id = ${id} AND account_id = ${accountId}
            RETURNING *;
        `;

        if (result.length === 0) {
            return NextResponse.json({ message: 'Payment not found or access denied' }, { status: 404 });
        }

        return NextResponse.json(result[0]);
    } catch (error: any) {
        return NextResponse.json({ message: 'Failed to update payment', error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const accountId = request.headers.get("x-account-id");
    if (!id || !accountId) return NextResponse.json({ message: 'ID and Account are required' }, { status: 400 });

    try {
        const result = await sql`UPDATE vendor_payments SET is_deleted = true WHERE id = ${id} AND account_id = ${accountId} RETURNING id`;
        if (result.length === 0) return NextResponse.json({ message: 'Payment not found or access denied' }, { status: 404 });
        return NextResponse.json({ message: 'Payment deleted' });
    } catch (error: any) {
        return NextResponse.json({ message: 'Failed to delete payment', error: error.message }, { status: 500 });
    }
}
