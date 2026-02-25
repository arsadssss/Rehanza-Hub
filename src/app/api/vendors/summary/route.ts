
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET() {
  try {
    const [vendorsRes, purchasesRes, paymentsRes] = await Promise.all([
        sql`SELECT id, vendor_name FROM vendors WHERE is_deleted = false`,
        sql`SELECT vendor_id, quantity, cost_per_unit FROM vendor_purchases WHERE is_deleted = false`,
        sql`SELECT vendor_id, amount FROM vendor_payments WHERE is_deleted = false`,
    ]);

    const vendors = vendorsRes || [];
    const purchases = purchasesRes || [];
    const payments = paymentsRes || [];

    const summaryData = vendors.map(vendor => {
      const vendorPurchases = purchases.filter(p => p.vendor_id === vendor.id);
      const vendorPayments = payments.filter(p => p.vendor_id === vendor.id);

      const total_purchase = vendorPurchases.reduce((sum, p) => sum + (Number(p.quantity || 0) * Number(p.cost_per_unit || 0)), 0);
      const total_paid = vendorPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const balance_due = total_purchase - total_paid;

      return { id: vendor.id, vendor_name: vendor.vendor_name, total_purchase, total_paid, balance_due };
    });

    const totalDue = summaryData.reduce((acc, vendor) => acc + (vendor.balance_due > 0 ? vendor.balance_due : 0), 0);
    const totalValue = purchases.reduce((sum, purchase) => sum + (Number(purchase.quantity || 0) * Number(purchase.cost_per_unit || 0)), 0);
    
    return NextResponse.json({
        summary: summaryData,
        totalDueAllVendors: totalDue,
        totalInventoryValue: totalValue
    });
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to fetch vendor summary', error: error.message }, { status: 500 });
  }
}
