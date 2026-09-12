import { NextRequest, NextResponse } from 'next/server';
import { getInventoryDataset } from '@/lib/inventory/inventory-service';
import { sql } from '@/lib/db';

export const revalidate = 0;

/**
 * GET /api/inventory
 * Authoritative SKU-level Inventory Dataset & Analytics
 * - Summary KPI cards (Total Value, Total Units, Low Stock, Out of Stock, Reserved)
 * - SKU Items linked to Products Master by Main SKU
 * - Category filters & Vendor list for suppliers
 */
export async function GET(request: NextRequest) {
  try {
    const accountId = request.headers.get('x-account-id');
    if (!accountId) {
      return NextResponse.json({ success: false, message: 'Account context missing' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const category = searchParams.get('category') || undefined;
    const status = searchParams.get('status') || undefined;

    const [dataset, vendors] = await Promise.all([
      getInventoryDataset(accountId, { search, category, status }),
      sql`
        SELECT id, vendor_name
        FROM vendors
        WHERE account_id::text = ${accountId}
        ORDER BY vendor_name ASC;
      `.catch(() => []),
    ]);

    return NextResponse.json({
      success: true,
      summary: dataset.summary,
      items: dataset.items,
      categories: dataset.categories,
      vendors: vendors.map((v: any) => ({
        id: v.id,
        name: v.vendor_name,
      })),
    });
  } catch (error: any) {
    console.error('API Inventory GET Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch inventory dataset' },
      { status: 500 }
    );
  }
}
