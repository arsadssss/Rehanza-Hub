import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account not selected" }, { status: 400 });
    }

    const result = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_received
      FROM platform_payouts
      WHERE is_deleted = false AND account_id = ${accountId}
    `;

    return NextResponse.json({
      success: true,
      total_received: Number(result[0]?.total_received || 0),
    });
  } catch (error: any) {
    console.error("API Payments Summary Error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch payments summary", error: error.message },
      { status: 500 }
    );
  }
}
