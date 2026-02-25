
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
  const fromDate = searchParams.get('from');
  const toDate = searchParams.get('to');
  const searchTerm = searchParams.get('search');
  const offset = (page - 1) * pageSize;

  try {
    let whereClauses = ['is_deleted = false'];
    let params: string[] = [];
    let paramIndex = 1;

    if (fromDate) {
        whereClauses.push(`expense_date >= $${paramIndex++}`);
        params.push(fromDate);
    }
    if (toDate) {
        whereClauses.push(`expense_date <= $${paramIndex++}`);
        params.push(toDate);
    }
    if (searchTerm) {
        whereClauses.push(`description ILIKE $${paramIndex++}`);
        params.push(`%${searchTerm}%`);
    }

    const whereString = `WHERE ${whereClauses.join(' AND ')}`;
    
    const dataQuery = `SELECT * FROM business_expenses ${whereString} ORDER BY expense_date DESC LIMIT ${pageSize} OFFSET ${offset}`;
    const countQuery = `SELECT COUNT(*) FROM business_expenses ${whereString}`;
    
    const [data, countResult] = await Promise.all([
        sql(dataQuery, params),
        sql(countQuery, params),
    ]);

    return NextResponse.json({ data, count: Number(countResult[0].count) });

  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to fetch expenses', error: error.message }, { status: 500 });
  }
}


export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { description, amount, expense_date } = body;
        if (!description || !amount || !expense_date) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }
        const result = await sql`
            INSERT INTO business_expenses (description, amount, expense_date)
            VALUES (${description}, ${amount}, ${expense_date})
            RETURNING *;
        `;
        return NextResponse.json(result[0], { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ message: 'Failed to create expense', error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, description, amount, expense_date } = body;
        if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

        const result = await sql`
            UPDATE business_expenses
            SET description = ${description}, amount = ${amount}, expense_date = ${expense_date}
            WHERE id = ${id}
            RETURNING *;
        `;
        if (result.length === 0) return NextResponse.json({ message: 'Expense not found' }, { status: 404 });
        return NextResponse.json(result[0]);
    } catch (error: any) {
        return NextResponse.json({ message: 'Failed to update expense', error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

    try {
        const result = await sql`
            UPDATE business_expenses SET is_deleted = true WHERE id = ${id} RETURNING id;
        `;
        if (result.length === 0) return NextResponse.json({ message: 'Expense not found' }, { status: 404 });
        return NextResponse.json({ message: 'Expense deleted' });
    } catch (error: any) {
        return NextResponse.json({ message: 'Failed to delete expense', error: error.message }, { status: 500 });
    }
}
