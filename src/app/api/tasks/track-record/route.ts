import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * GET /api/tasks/track-record
 * Aggregates task statistics by user for the active account.
 */
export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    // Aggregating performance metrics per user
    // We join with the users table to get display names
    const rows = await sql`
      SELECT 
        u.name AS user_name,
        t.created_by,
        COUNT(t.id)::int AS total_tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'Pending')::int AS pending,
        COUNT(t.id) FILTER (WHERE t.status = 'In Progress')::int AS in_progress,
        COUNT(t.id) FILTER (WHERE t.status = 'Completed')::int AS completed
      FROM tasks t
      JOIN users u ON t.created_by = u.id
      WHERE t.account_id = ${accountId} AND t.is_deleted = false
      GROUP BY u.name, t.created_by
      ORDER BY total_tasks DESC;
    `;

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error("API Task Track Record Error:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Failed to fetch track record", 
      error: error.message 
    }, { status: 500 });
  }
}
