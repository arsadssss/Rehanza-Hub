import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET() {
  try {
    // Get spending grouped by day for the last 7 days, including days with 0 expenses
    const trend = await sql`
      SELECT 
        d.date::date as date,
        COALESCE(SUM(e.amount), 0)::numeric as total
      FROM (
        SELECT (CURRENT_DATE - i * INTERVAL '1 day')::date as date 
        FROM generate_series(0, 6) i
      ) d
      LEFT JOIN business_expenses e ON DATE(e.expense_date) = d.date AND e.is_deleted = false
      GROUP BY d.date
      ORDER BY d.date ASC
    `;

    return NextResponse.json({
      trend: (trend || []).map((t: any) => ({
        date: t.date,
        total: Number(t.total || 0)
      }))
    });
  } catch (error: any) {
    console.error("API Expenses Analytics Error:", error);
    return NextResponse.json({ message: 'Failed to fetch analytics', error: error.message }, { status: 500 });
  }
}
