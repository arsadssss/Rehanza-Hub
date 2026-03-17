import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const revalidate = 0;

const calculateProgress = (allTasks: any[]) => {
    const overallTotal = allTasks.length;
    const overallCompleted = allTasks.filter(t => t.status === 'Completed').length;
    
    const fashionTasks = allTasks.filter(t => t.task_group === 'Fashion');
    const fashionTotal = fashionTasks.length;
    const fashionCompleted = fashionTasks.filter(t => t.status === 'Completed').length;

    const cosmeticsTasks = allTasks.filter(t => t.task_group === 'Cosmetics');
    const cosmeticsTotal = cosmeticsTasks.length;
    const cosmeticsCompleted = cosmeticsTasks.filter(t => t.status === 'Completed').length;

    return {
        overall: { total: overallTotal, completed: overallCompleted, percentage: overallTotal > 0 ? (overallCompleted / overallTotal) * 100 : 0 },
        fashion: { total: fashionTotal, completed: fashionCompleted, percentage: fashionTotal > 0 ? (fashionCompleted / fashionTotal) * 100 : 0 },
        cosmetics: { total: cosmeticsTotal, completed: cosmeticsCompleted, percentage: cosmeticsTotal > 0 ? (cosmeticsCompleted / cosmeticsTotal) * 100 : 0 },
    };
};

/**
 * Helper to calculate status based on listing steps
 */
function calculateListingStatus(steps: any) {
    if (!steps) return 'Pending';
    const values = Object.values(steps);
    const completedCount = values.filter(Boolean).length;
    const totalCount = values.length;

    if (completedCount === 0) return 'Pending';
    if (completedCount === totalCount) return 'Completed';
    return 'In Progress';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
  const group = searchParams.get('group');
  const status = searchParams.get('status');
  const offset = (page - 1) * pageSize;

  try {
    let whereClauses = ['t.is_deleted = false'];
    let params: any[] = [];
    let paramIndex = 1;

    if (group && group !== 'all') {
        whereClauses.push(`t.task_group = $${paramIndex++}`);
        params.push(group);
    }
    if (status && status !== 'all') {
        whereClauses.push(`t.status = $${paramIndex++}`);
        params.push(status);
    }

    const whereString = `WHERE ${whereClauses.join(' AND ')}`;
    
    const dataQuery = `
        SELECT 
            t.*, 
            cu.name AS created_by_name, 
            uu.name AS updated_by_name 
        FROM tasks t 
        LEFT JOIN users cu ON t.created_by = cu.id 
        LEFT JOIN users uu ON t.updated_by = uu.id 
        ${whereString} 
        ORDER BY t.task_date DESC, t.created_at DESC 
        LIMIT ${pageSize} OFFSET ${offset}
    `;
    const countQuery = `SELECT COUNT(*) FROM tasks t ${whereString}`;
    const progressQuery = `SELECT status, task_group FROM tasks WHERE is_deleted = false`;

    const [data, countResult, progressResult] = await Promise.all([
        sql(dataQuery, params),
        sql(countQuery, params),
        sql(progressQuery)
    ]);
    
    const progress = calculateProgress(progressResult);

    return NextResponse.json({ 
        data: (data || []).map((t: any) => ({
            ...t,
            is_today: !!t.is_today,
            is_listing_task: !!t.is_listing_task,
            listing_steps: t.listing_steps || null
        })), 
        count: Number(countResult[0]?.count || 0), 
        progress 
    });

  } catch (error: any) {
    console.error("API Tasks GET Error:", error);
    return NextResponse.json({ message: 'Failed to fetch tasks', error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const body = await request.json();
        const { task_name, task_date, task_group, notes, is_today, is_listing_task, listing_steps } = body;
        
        if (!task_name || !task_date || !task_group) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        let finalStatus = body.status || 'Pending';
        let finalListingSteps = null;

        if (is_listing_task) {
            finalListingSteps = listing_steps || {
                imageGeneration: false,
                meesho: false,
                flipkart: false,
                amazon: false
            };
            finalStatus = calculateListingStatus(finalListingSteps);
        }
        
        const result = await sql`
            INSERT INTO tasks (
                task_name, task_date, task_group, status, notes, 
                created_by, created_at, is_today, is_listing_task, listing_steps
            )
            VALUES (
                ${task_name}, ${task_date}, ${task_group}, ${finalStatus}, ${notes}, 
                ${session.user.id}, NOW(), ${!!is_today}, ${!!is_listing_task}, ${JSON.stringify(finalListingSteps)}
            )
            RETURNING *;
        `;
        return NextResponse.json(result[0], { status: 201 });
    } catch (error: any) {
        console.error("API Tasks POST Error:", error);
        return NextResponse.json({ message: 'Failed to create task', error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const body = await request.json();
        const { id, task_name, task_date, task_group, status, notes, is_today, is_listing_task, listing_steps, quick_today_toggle } = body;
        
        if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

        // Handle quick "Move to Today" toggle from list
        if (quick_today_toggle !== undefined) {
            const result = await sql`
                UPDATE tasks
                SET is_today = ${!!quick_today_toggle}, updated_at = NOW(), updated_by = ${session.user.id}
                WHERE id = ${id}
                RETURNING *;
            `;
            return NextResponse.json(result[0]);
        }

        let finalStatus = status;
        if (is_listing_task) {
            finalStatus = calculateListingStatus(listing_steps);
        }

        const result = await sql`
            UPDATE tasks
            SET 
                task_name = ${task_name}, 
                task_date = ${task_date}, 
                task_group = ${task_group}, 
                status = ${finalStatus}, 
                notes = ${notes},
                is_today = ${!!is_today},
                is_listing_task = ${!!is_listing_task},
                listing_steps = ${JSON.stringify(listing_steps)},
                updated_by = ${session.user.id},
                updated_at = NOW()
            WHERE id = ${id}
            RETURNING *;
        `;
        if (result.length === 0) return NextResponse.json({ message: 'Task not found' }, { status: 404 });
        return NextResponse.json(result[0]);
    } catch (error: any) {
        console.error("API Tasks PUT Error:", error);
        return NextResponse.json({ message: 'Failed to update task', error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

    try {
        const result = await sql`
            UPDATE tasks SET is_deleted = true WHERE id = ${id} RETURNING id;
        `;
        if (result.length === 0) return NextResponse.json({ message: 'Task not found' }, { status: 404 });
        return NextResponse.json({ message: 'Task deleted' });
    } catch (error: any) {
        return NextResponse.json({ message: 'Failed to delete task', error: error.message }, { status: 500 });
    }
}
