import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    // Normalizing logic using LIKE for inconsistent status values
    const statsRes = await sql`
      SELECT 
        COUNT(*)::int as total_returns,
        COALESCE(SUM(quantity), 0)::int as total_units,
        COUNT(*) FILTER (WHERE return_date = CURRENT_DATE)::int as today_returns,
        COUNT(*) FILTER (
          WHERE LOWER(status) LIKE '%rto%' 
          OR LOWER(status) LIKE '%courier%' 
          OR LOWER(status) LIKE '%undelivered%'
          OR LOWER(return_type) IN ('rto', 'dto')
        )::int as rto_count,
        COUNT(*) FILTER (
          WHERE LOWER(status) LIKE '%customer%'
          OR LOWER(status) LIKE '%rejected%'
          OR LOWER(return_type) IN ('customer_return', 'exchange')
        )::int as customer_count
      FROM returns
      WHERE account_id = ${accountId} AND is_deleted = false
    `;

    const stats = statsRes[0];

    return NextResponse.json({
      success: true,
      data: {
        totalReturns: stats.total_returns,
        totalUnits: stats.total_units,
        todayReturns: stats.today_returns,
        rtoCount: stats.rto_count,
        customerCount: stats.customer_count
      }
    });

  } catch (error: any) {
    console.error("API Returns Stats GET Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch stats", error: error.message }, { status: 500 });
  }
}
