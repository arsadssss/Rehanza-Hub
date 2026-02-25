import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET() {
  try {
    const [purchasesRes, paymentsRes] = await Promise.all([
      sql`SELECT COALESCE(SUM(quantity * cost_per_unit), 0) as total_purchase FROM vendor_purchases WHERE is_deleted = false`,
      sql`SELECT COALESCE(SUM(amount), 0) as total_paid FROM vendor_payments WHERE is_deleted = false`
    ]);

    const totalPurchase = Number(purchasesRes[0]?.total_purchase || 0);
    const totalPaid = Number(paymentsRes[0]?.total_paid || 0);

    return NextResponse.json({
      success: true,
      data: {
        total_due: totalPurchase - totalPaid,
        total_purchase_value: totalPurchase,
      },
    });

  } catch (error: any) {
    console.error("Vendor summary error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
