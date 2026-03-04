import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET() {
  try {
    const users = await sql`SELECT id, name FROM users ORDER BY name ASC`;
    return NextResponse.json(users);
  } catch (error: any) {
    console.error("API Users GET Error:", error);
    return NextResponse.json({ message: 'Failed to fetch users' }, { status: 500 });
  }
}
