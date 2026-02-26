import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account not selected" }, { status: 400 });
    }

    const [payoutRes, expenseRes] = await Promise.all([
      sql`SELECT COALESCE(SUM(amount), 0) as total FROM platform_payouts WHERE is_deleted = false AND account_id = ${accountId}`,
      sql`SELECT COALESCE(SUM(amount), 0) as total FROM business_expenses WHERE is_deleted = false AND account_id = ${accountId}`
    ]);

    const totalReceived = Number(payoutRes[0]?.total || 0);
    const totalExpenses = Number(expenseRes[0]?.total || 0);
    const netCashFlow = totalReceived - totalExpenses;

    return NextResponse.json({
      total_received: totalReceived,
      total_expenses: totalExpenses,
      net_cash_flow: netCashFlow
    });
  } catch (error: any) {
    console.error("API Finance Summary Error:", error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch finance summary', error: error.message },
      { status: 500 }
    );
  }
}
