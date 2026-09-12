import { NextRequest, NextResponse } from 'next/server';
import { assignSkuToMainProduct } from '@/lib/products/sku-registry-service';

export const revalidate = 0;

/**
 * POST /api/products/assign
 * Assigns, reassigns (moves), or unassigns a Platform SKU to a Main Product.
 * Request body:
 * {
 *   skuId: string,
 *   mainProductId: string | null
 * }
 */
export async function POST(request: NextRequest) {
  const accountId = request.headers.get('x-account-id');
  if (!accountId) {
    return NextResponse.json({ success: false, message: 'Account context missing' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { skuId, mainProductId } = body;

    if (!skuId) {
      return NextResponse.json({ success: false, message: 'skuId is required' }, { status: 400 });
    }

    const updated = await assignSkuToMainProduct(accountId, skuId, mainProductId || null);

    return NextResponse.json({
      success: true,
      message: mainProductId ? 'SKU assigned to Main Product' : 'SKU unassigned',
      data: updated,
    });
  } catch (error: any) {
    console.error('API Products Assign POST Error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to update SKU assignment' }, { status: 500 });
  }
}

