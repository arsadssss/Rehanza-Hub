import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { saveSkuCostById } from '@/lib/reconciliation/sku-master-service';

export const revalidate = 0;

/**
 * PUT /api/reconciliation/sku-master/[id]
 * Edit existing SKU cost and packaging. Triggers targeted transaction recalculation.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const headerAccountId = request.headers.get('x-account-id');
    const accountId = headerAccountId || (session?.user as any)?.accountId;

    if (!accountId) {
      return NextResponse.json(
        { success: false, message: 'Account context missing' },
        { status: 400 }
      );
    }

    const { id } = await params;
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return NextResponse.json(
        { success: false, message: 'Invalid SKU master ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { productName, costPrice, packagingCost } = body;

    if (costPrice === undefined || costPrice === null || isNaN(Number(costPrice)) || Number(costPrice) < 0) {
      return NextResponse.json(
        { success: false, message: 'Valid non-negative Cost Price is required' },
        { status: 400 }
      );
    }

    if (packagingCost === undefined || packagingCost === null || isNaN(Number(packagingCost)) || Number(packagingCost) < 0) {
      return NextResponse.json(
        { success: false, message: 'Valid non-negative Packaging Cost is required' },
        { status: 400 }
      );
    }

    const result = await saveSkuCostById(accountId, numericId, {
      costPrice: Number(costPrice),
      packagingCost: Number(packagingCost),
      productName: productName ? String(productName).trim() : null,
    });

    return NextResponse.json({
      success: true,
      sku: result.sku,
      affectedTransactions: result.affectedTransactions,
      message: `SKU updated successfully. Recalculated ${result.affectedTransactions} transactions.`,
    });
  } catch (error: any) {
    console.error('SKU Master PUT Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update SKU cost' },
      { status: 500 }
    );
  }
}

