import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = request.headers.get("x-account-id");
  if (!accountId) return NextResponse.json({ message: "Account not selected" }, { status: 400 });

  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
  const fromDate = searchParams.get('from');
  const toDate = searchParams.get('to');
  const searchTerm = searchParams.get('search');
  const offset = (page - 1) * pageSize;

  try {
    let whereClauses = ['e.is_deleted = false', `e.account_id = $1` as any];
    let params: any[] = [accountId];
    let paramIndex = 2;

    if (fromDate) {
        whereClauses.push(`e.expense_date >= $${paramIndex++}`);
        params.push(fromDate);
    }
    if (toDate) {
        whereClauses.push(`e.expense_date <= $${paramIndex++}`);
        params.push(toDate);
    }
    if (searchTerm) {
        whereClauses.push(`e.description ILIKE $${paramIndex++}`);
        params.push(`%${searchTerm}%`);
    }

    const whereString = `WHERE ${whereClauses.join(' AND ')}`;
    
    const dataQuery = `
        SELECT 
            e.*, 
            cu.name AS created_by_name, 
            uu.name AS updated_by_name 
        FROM business_expenses e 
        LEFT JOIN users cu ON e.created_by = cu.id 
        LEFT JOIN users uu ON e.updated_by = uu.id 
        ${whereString} 
        ORDER BY e.expense_date DESC 
        LIMIT ${pageSize} OFFSET ${offset}
    `;
    const countQuery = `SELECT COUNT(*) FROM business_expenses e ${whereString}`;
    
    const [data, countResult] = await Promise.all([
        sql(dataQuery, params),
        sql(countQuery, params),
    ]);

    const formattedData = (data || []).map((e: any) => ({
        ...e,
        amount: Number(e.amount || 0)
    }));

    return NextResponse.json({ data: formattedData, count: Number(countResult[0]?.count || 0) });

  } catch (error: any) {
    console.error("API Expenses GET Error:", error);
    return NextResponse.json({ message: 'Failed to fetch expenses', error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        const accountId = request.headers.get("x-account-id");
        if (!session || !accountId) return NextResponse.json({ message: "Unauthorized or Account not selected" }, { status: 401 });

        const body = await request.json();
        const { description, amount, expense_date } = body;
        if (!description || !amount || !expense_date) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }
        
        const result = await sql`
            INSERT INTO business_expenses (description, amount, expense_date, created_by, account_id, created_at)
            VALUES (${description}, ${amount}, ${expense_date}, ${session.user.id}, ${accountId}, NOW())
            RETURNING *;
        `;
        return NextResponse.json(result[0], { status: 201 });
    } catch (error: any) {
        console.error("API Expenses POST Error:", error);
        return NextResponse.json({ message: 'Failed to create expense', error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        const accountId = request.headers.get("x-account-id");
        if (!session || !accountId) return NextResponse.json({ message: "Unauthorized or Account not selected" }, { status: 401 });

        const body = await request.json();
        const { id, description, amount, expense_date } = body;
        if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

        const result = await sql`
            UPDATE business_expenses
            SET 
                description = ${description}, 
                amount = ${amount}, 
                expense_date = ${expense_date},
                updated_by = ${session.user.id},
                updated_at = NOW()
            WHERE id = ${id} AND account_id = ${accountId}
            RETURNING *;
        `;
        if (result.length === 0) return NextResponse.json({ message: 'Expense not found or access denied' }, { status: 404 });
        return NextResponse.json(result[0]);
    } catch (error: any) {
        console.error("API Expenses PUT Error:", error);
        return NextResponse.json({ message: 'Failed to update expense', error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const accountId = request.headers.get("x-account-id");
    if (!id || !accountId) return NextResponse.json({ message: 'ID and Account are required' }, { status: 400 });

    try {
        const result = await sql`
            UPDATE business_expenses SET is_deleted = true 
            WHERE id = ${id} AND account_id = ${accountId} 
            RETURNING id;
        `;
        if (result.length === 0) return NextResponse.json({ message: 'Expense not found or access denied' }, { status: 404 });
        return NextResponse.json({ message: 'Expense deleted' });
    } catch (error: any) {
        return NextResponse.json({ message: 'Failed to delete expense', error: error.message }, { status: 500 });
    }
}
