
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET() {
  try {
    const [expenseRes, payoutRes] = await Promise.all([
      sql`SELECT amount FROM business_expenses WHERE is_deleted = false`,
      sql`SELECT gst_account, amount FROM platform_payouts WHERE is_deleted = false`
    ]);

    const totalExpenses = expenseRes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    
    const fashionTotal = payoutRes
        .filter(row => row.gst_account === "Fashion")
        .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    
    const cosmeticsTotal = payoutRes
        .filter(row => row.gst_account === "Cosmetics")
        .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    
    const totalPayouts = fashionTotal + cosmeticsTotal;

    return NextResponse.json({
        totalExpenses,
        totalPayouts,
        totalFashionPayouts: fashionTotal,
        totalCosmeticsPayouts: cosmeticsTotal,
    });
  } catch (error: any) {
    console.error('API Financial Summary Error:', error);
    return NextResponse.json({ message: 'Failed to fetch financial summary', error: error.message }, { status: 500 });
  }
}
