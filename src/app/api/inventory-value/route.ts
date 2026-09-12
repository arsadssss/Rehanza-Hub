import { NextResponse } from 'next/server';
import { getInventoryDataset } from '@/lib/inventory/inventory-service';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account not selected" }, { status: 400 });
    }

    const dataset = await getInventoryDataset(accountId);
    const totalValue = Number(dataset?.summary?.totalInventoryValue || 0);

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
