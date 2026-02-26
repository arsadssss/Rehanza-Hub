import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * GET /api/finance-summary
 * Aggregates total payments received and total business expenses.
 */
export async function GET() {
  try {
    const [payoutRes, expenseRes] = await Promise.all([
      sql`SELECT COALESCE(SUM(amount), 0) as total FROM platform_payouts WHERE is_deleted = false`,
      sql`SELECT COALESCE(SUM(amount), 0) as total FROM business_expenses WHERE is_deleted = false`
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
