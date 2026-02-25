import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
  const account = searchParams.get('account');
  const platform = searchParams.get('platform');
  const fromDate = searchParams.get('from');
  const toDate = searchParams.get('to');
  const offset = (page - 1) * pageSize;

  try {
    let whereClauses = ['is_deleted = false'];
    let params: any[] = [];
    let paramIndex = 1;

    if (account && account !== 'all') {
        whereClauses.push(`gst_account = $${paramIndex++}`);
        params.push(account);
    }
    if (platform && platform !== 'all') {
        whereClauses.push(`platform = $${paramIndex++}`);
        params.push(platform);
    }
    if (fromDate) {
        whereClauses.push(`payout_date >= $${paramIndex++}`);
        params.push(fromDate);
    }
    if (toDate) {
        whereClauses.push(`payout_date <= $${paramIndex++}`);
        params.push(toDate);
    }
    
    const whereString = `WHERE ${whereClauses.join(' AND ')}`;
    
    const dataQuery = `SELECT * FROM platform_payouts ${whereString} ORDER BY payout_date DESC LIMIT ${pageSize} OFFSET ${offset}`;
    const countQuery = `SELECT COUNT(*) FROM platform_payouts ${whereString}`;
    
    // sql helper now supports (query, params) pattern correctly
    const [data, countResult] = await Promise.all([
        sql(dataQuery, params),
        sql(countQuery, params),
    ]);

    const formattedData = (data || []).map((p: any) => ({
        ...p,
        amount: Number(p.amount || 0)
    }));

    return NextResponse.json({ data: formattedData, count: Number(countResult[0]?.count || 0) });

  } catch (error: any) {
    console.error("API Payouts GET Error:", error);
    return NextResponse.json({ message: 'Failed to fetch payouts', error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { gst_account, platform, amount, payout_date, reference } = body;
        if (!gst_account || !platform || !amount || !payout_date) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }
        const result = await sql`
            INSERT INTO platform_payouts (gst_account, platform, amount, payout_date, reference)
            VALUES (${gst_account}, ${platform}, ${amount}, ${payout_date}, ${reference})
            RETURNING *;
        `;
        return NextResponse.json(result[0], { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ message: 'Failed to create payout', error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, gst_account, platform, amount, payout_date, reference } = body;
        if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

        const result = await sql`
            UPDATE platform_payouts
            SET gst_account = ${gst_account}, platform = ${platform}, amount = ${amount}, payout_date = ${payout_date}, reference = ${reference}
            WHERE id = ${id}
            RETURNING *;
        `;
        if (result.length === 0) return NextResponse.json({ message: 'Payout not found' }, { status: 404 });
        return NextResponse.json(result[0]);
    } catch (error: any) {
        return NextResponse.json({ message: 'Failed to update payout', error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

    try {
        const result = await sql`
            UPDATE platform_payouts SET is_deleted = true WHERE id = ${id} RETURNING id;
        `;
        if (result.length === 0) return NextResponse.json({ message: 'Payout not found' }, { status: 404 });
        return NextResponse.json({ message: 'Payout deleted' });
    } catch (error: any) {
        return NextResponse.json({ message: 'Failed to delete payout', error: error.message }, { status: 500 });
    }
}
