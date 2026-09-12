import { NextRequest, NextResponse } from 'next/server';
import {
  syncSkusFromReconciliation,
  getProductsDashboardMetrics,
  getMainProducts,
  getPlatformSkus,
  getPendingAiSuggestions,
} from '@/lib/products/sku-registry-service';
import { sql } from '@/lib/db';

export const revalidate = 0;

/**
 * GET /api/products
 * Returns the unified Two-Tier product management dataset for the active account:
 * - Summary KPI cards (Main Products, Platform SKUs, Unassigned, Pending AI)
 * - Main Products list with linked platform SKUs and aggregated metrics
 * - Platform SKUs list with reconciliation-derived costs and settlement metrics
 * - Pending AI grouping suggestions with confidence and match signals
 *
 * Automatic discovery: If no platform SKUs exist yet or ?sync=true is provided,
 * automatically runs reconciliation SKU discovery.
 */
export async function GET(request: NextRequest) {
  const accountId = request.headers.get('x-account-id');

  if (!accountId) {
    return NextResponse.json(
      { success: false, message: 'Account context missing' },
      { status: 400 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const status = (searchParams.get('status') as any) || 'all';
    const forceSync = searchParams.get('sync') === 'true';

    // Check if initial discovery is needed
    if (forceSync) {
      await syncSkusFromReconciliation(accountId);
    } else {
      const [existingCount] = await sql`
        SELECT COUNT(*)::int as count FROM product_skus WHERE account_id = ${accountId};
      `;
      if (!existingCount || existingCount.count === 0) {
        // Run initial discovery from existing reconciliation data
        await syncSkusFromReconciliation(accountId);
      }
    }

    const [summary, mainProducts, platformSkus, pendingSuggestions] = await Promise.all([
      getProductsDashboardMetrics(accountId),
      getMainProducts(accountId, search),
      getPlatformSkus(accountId, { search, status }),
      getPendingAiSuggestions(accountId),
    ]);

    return NextResponse.json({
      success: true,
      summary,
      mainProducts,
      platformSkus,
      pendingSuggestions,
    });
  } catch (error: any) {
    console.error('API Products GET Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
