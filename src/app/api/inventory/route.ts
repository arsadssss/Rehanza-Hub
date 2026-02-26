import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ message: "Account not selected" }, { status: 400 });
    }

    // Assuming inventory_summary view includes account_id
    const data = await sql`SELECT * FROM inventory_summary WHERE account_id = ${accountId}`;
    
    const dataWithFormatting = data.map(item => ({
        ...item,
        low_stock_threshold: item.low_stock_threshold || 5,
    }));
    
    return NextResponse.json(dataWithFormatting);
  } catch (error: any) {
    console.error("API Inventory Error:", error);
    return NextResponse.json({ message: "Failed to fetch inventory summary", error: error.message }, { status: 500 });
  }
}
