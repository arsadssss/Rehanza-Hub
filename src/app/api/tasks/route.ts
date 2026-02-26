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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // GLOBAL - No x-account-id check

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

    return NextResponse.json({ data, count: Number(countResult[0]?.count || 0), progress });

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
        const { task_name, task_date, task_group, status, notes } = body;
        if (!task_name || !task_date || !task_group || !status) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }
        
        const result = await sql`
            INSERT INTO tasks (task_name, task_date, task_group, status, notes, created_by, created_at)
            VALUES (${task_name}, ${task_date}, ${task_group}, ${status}, ${notes}, ${session.user.id}, NOW())
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
        const { id, task_name, task_date, task_group, status, notes } = body;
        if (!id) return NextResponse.json({ message: 'ID is required' }, { status: 400 });

        const result = await sql`
            UPDATE tasks
            SET 
                task_name = ${task_name}, 
                task_date = ${task_date}, 
                task_group = ${task_group}, 
                status = ${status}, 
                notes = ${notes},
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
