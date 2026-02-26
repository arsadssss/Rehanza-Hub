
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

/**
 * GET total inventory investment value
 * Calculated as SUM(variant stock * product cost price)
 */
export async function GET() {
  try {
    const result = await sql`
      SELECT SUM(v.stock * p.cost_price) as total_value
      FROM product_variants v
      JOIN allproducts p ON v.product_id = p.id
    `;
    
    const totalValue = Number(result[0]?.total_value || 0);
    
    return NextResponse.json({ 
      success: true, 
      total_value: totalValue 
    });
  } catch (error: any) {
    console.error("API Inventory Value Error:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Failed to fetch inventory value", 
      error: error.message 
    }, { status: 500 });
  }
}
