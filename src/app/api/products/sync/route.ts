import { NextRequest, NextResponse } from 'next/server';
import { syncSkusFromReconciliation } from '@/lib/products/sku-registry-service';

export const revalidate = 0;

/**
 * POST /api/products/sync
 * Manually triggers SKU discovery and metrics update from reconciliation transactions and master.
 */
export async function POST(request: NextRequest) {
  const accountId = request.headers.get('x-account-id');
  if (!accountId) {
    return NextResponse.json({ success: false, message: 'Account context missing' }, { status: 400 });
  }

  try {
    const stats = await syncSkusFromReconciliation(accountId);
    return NextResponse.json({
      success: true,
      message: `Synchronized ${stats.totalDiscovered} SKUs (${stats.newlyCreated} newly created, ${stats.updated} updated)`,
      stats,
    });
  } catch (error: any) {
    console.error('API Products Sync POST Error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to sync SKUs' }, { status: 500 });
  }
}

