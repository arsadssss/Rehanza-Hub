
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request, { params }: { params: { vendorId: string } }) {
  const { vendorId } = params;

  if (!vendorId) {
    return NextResponse.json({ message: 'Vendor ID is required' }, { status: 400 });
  }

  try {
    const [purchases, payments] = await Promise.all([
      sql`SELECT * FROM vendor_purchases WHERE vendor_id = ${vendorId} AND is_deleted = false`,
      sql`SELECT * FROM vendor_payments WHERE vendor_id = ${vendorId} AND is_deleted = false`
    ]);

    return NextResponse.json({ purchases, payments });
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to fetch ledger', error: error.message }, { status: 500 });
  }
}
