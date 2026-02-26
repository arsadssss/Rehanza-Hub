import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const revalidate = 0;

/**
 * GET /api/analytics/user-performance
 * Returns task completion metrics for each user.
 */
export async function GET() {
  try {
    // 1. Protect the route
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Query Neon for performance stats
    // We join users with tasks to count total vs completed
    const rows = await sql`
      SELECT 
        u.id, 
        u.name, 
        COUNT(t.id)::int as total_tasks,
        COUNT(CASE WHEN t.status = 'Completed' THEN 1 END)::int as completed_tasks,
        CASE 
          WHEN COUNT(t.id) = 0 THEN 0 
          ELSE ROUND(
            (COUNT(CASE WHEN t.status = 'Completed' THEN 1 END)::decimal 
            / NULLIF(COUNT(t.id), 0)) * 100
          , 1) 
        END as completion_rate
      FROM public.users u
      LEFT JOIN public.tasks t 
        ON t.created_by = u.id 
        AND t.is_deleted = false
      GROUP BY u.id, u.name
      ORDER BY completion_rate DESC;
    `;

    // 3. Return successful response
    return NextResponse.json({
      success: true,
      data: rows,
    });

  } catch (error: any) {
    console.error('User Performance API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch user performance data', 
        error: error.message 
      },
      { status: 500 }
    );
  }
}
