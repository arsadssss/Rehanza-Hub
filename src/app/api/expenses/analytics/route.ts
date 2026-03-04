import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET() {
  try {
    // Get spending grouped by week for the last 8 weeks
    const trend = await sql`
      SELECT 
        DATE_TRUNC('week', expense_date) AS week, 
        SUM(amount)::numeric AS total 
      FROM business_expenses 
      WHERE is_deleted = false 
      GROUP BY week 
      ORDER BY week ASC 
      LIMIT 8
    `;

    return NextResponse.json({
      trend: (trend || []).map((t: any) => ({
        week: t.week,
        total: Number(t.total || 0)
      }))
    });
  } catch (error: any) {
    console.error("API Expenses Analytics Error:", error);
    return NextResponse.json({ message: 'Failed to fetch analytics', error: error.message }, { status: 500 });
  }
}
