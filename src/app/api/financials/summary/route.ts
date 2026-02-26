import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) return NextResponse.json({ message: "Account missing" }, { status: 400 });

    const [expenseRes, payoutRes] = await Promise.all([
      sql`SELECT amount FROM business_expenses WHERE is_deleted = false AND account_id = ${accountId}`,
      sql`SELECT gst_account, amount FROM platform_payouts WHERE is_deleted = false AND account_id = ${accountId}`
    ]);

    const totalExpenses = expenseRes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalPayouts = payoutRes.reduce((sum, row) => sum + Number(row.amount || 0), 0);

    return NextResponse.json({
        totalExpenses,
        totalPayouts,
    });
  } catch (error: any) {
    console.error('API Financial Summary Error:', error);
    return NextResponse.json({ message: 'Failed to fetch financial summary', error: error.message }, { status: 500 });
  }
}
