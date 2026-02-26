import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request, { params }: { params: Promise<{ vendorId: string }> }) {
  try {
    const { vendorId } = await params;
    const accountId = request.headers.get("x-account-id");

    if (!vendorId || !accountId) {
      return NextResponse.json({ success: false, message: 'Vendor ID and Account are required' }, { status: 400 });
    }

    const [purchases, payments] = await Promise.all([
      sql`SELECT * FROM vendor_purchases WHERE vendor_id = ${vendorId} AND account_id = ${accountId} AND is_deleted = false`,
      sql`SELECT * FROM vendor_payments WHERE vendor_id = ${vendorId} AND account_id = ${accountId} AND is_deleted = false`
    ]);

    return NextResponse.json({ 
      success: true,
      purchases: (purchases || []).map((p: any) => ({ ...p, quantity: Number(p.quantity), cost_per_unit: Number(p.cost_per_unit) })), 
      payments: (payments || []).map((p: any) => ({ ...p, amount: Number(p.amount) }))
    });
  } catch (error: any) {
    console.error("API Vendor Ledger Error:", error);
    return NextResponse.json({ success: false, message: 'Failed to fetch ledger', error: error.message }, { status: 500 });
  }
}
