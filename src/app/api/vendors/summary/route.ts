import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET() {
  try {
    const [vendorsRes, purchasesRes, paymentsRes] = await Promise.all([
        sql`SELECT id, vendor_name FROM vendors WHERE is_deleted = false`,
        sql`SELECT vendor_id, (quantity * cost_per_unit)::numeric as line_total FROM vendor_purchases WHERE is_deleted = false`,
        sql`SELECT vendor_id, amount::numeric as amount FROM vendor_payments WHERE is_deleted = false`,
    ]);

    const summaryData = vendorsRes.map((vendor: any) => {
      const total_purchase = purchasesRes
        .filter((p: any) => p.vendor_id === vendor.id)
        .reduce((sum: number, p: any) => sum + Number(p.line_total), 0);
      
      const total_paid = paymentsRes
        .filter((p: any) => p.vendor_id === vendor.id)
        .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      return {
        id: vendor.id,
        vendor_name: vendor.vendor_name,
        total_purchase,
        total_paid,
        balance_due: total_purchase - total_paid
      };
    });

    const totalDue = summaryData.reduce((acc: number, v: any) => acc + (v.balance_due > 0 ? v.balance_due : 0), 0);
    const totalInventoryValue = purchasesRes.reduce((acc: number, p: any) => acc + Number(p.line_total), 0);
    
    return NextResponse.json({
        success: true,
        summary: summaryData,
        totalDueAllVendors: totalDue,
        totalInventoryValue: totalInventoryValue
    });
  } catch (error: any) {
    console.error("Vendor Summary API Error:", error);
    return NextResponse.json({ success: false, message: 'Failed to fetch vendor summary', error: error.message }, { status: 500 });
  }
}
