
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET() {
  try {
    const data = await sql`SELECT * FROM inventory_summary`;
    
    const dataWithFormatting = data.map(item => ({
        ...item,
        low_stock_threshold: item.low_stock_threshold || 5, // Temporary fix if not in view
    }));
    
    return NextResponse.json(dataWithFormatting);
  } catch (error: any) {
    console.error("API Inventory Error:", error);
    return NextResponse.json({ message: "Failed to fetch inventory summary", error: error.message }, { status: 500 });
  }
}
