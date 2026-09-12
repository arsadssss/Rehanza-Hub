import { NextRequest, NextResponse } from 'next/server';
import { getInventoryMovements } from '@/lib/inventory/inventory-service';

export const revalidate = 0;

/**
 * GET /api/inventory/movements
 * Returns paginated stock movement history for the active account.
 */
export async function GET(request: NextRequest) {
  try {
    const accountId = request.headers.get('x-account-id');
    if (!accountId) {
      return NextResponse.json({ success: false, message: 'Account context missing' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const mainSku = searchParams.get('mainSku') || undefined;
    const movementType = searchParams.get('movementType') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;

    const data = await getInventoryMovements(accountId, {
      mainSku,
      movementType,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      movements: data.movements,
      total: data.total,
    });
  } catch (error: any) {
    console.error('API Inventory Movements GET Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch inventory movements' },
      { status: 500 }
    );
  }
}

