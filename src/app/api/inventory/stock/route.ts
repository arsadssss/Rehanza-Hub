import { NextRequest, NextResponse } from 'next/server';
import {
  addStockTransaction,
  adjustStockTransaction,
  updateInventoryRecord,
  deleteInventoryRecord,
} from '@/lib/inventory/inventory-service';

export const revalidate = 0;

/**
 * POST /api/inventory/stock
 * Handles atomic Add Stock, Adjust Stock, and Edit/Update Stock operations.
 */
export async function POST(request: NextRequest) {
  try {
    const accountId = request.headers.get('x-account-id');
    if (!accountId) {
      return NextResponse.json({ success: false, message: 'Account context missing' }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body;

    if (!action || !['add', 'adjust', 'update'].includes(action)) {
      return NextResponse.json(
        { success: false, message: "Invalid action. Must be 'add', 'adjust', or 'update'." },
        { status: 400 }
      );
    }

    if (action === 'add') {
      const { mainSku, quantity, costPrice, supplier, batchLot, location, notes } = body;
      if (!mainSku) {
        return NextResponse.json({ success: false, message: 'Main SKU is required.' }, { status: 400 });
      }
      if (!quantity || Number(quantity) <= 0) {
        return NextResponse.json({ success: false, message: 'Quantity to add must be greater than 0.' }, { status: 400 });
      }

      const result = await addStockTransaction(accountId, {
        mainSku,
        quantity: Number(quantity),
        costPrice: costPrice !== undefined ? Number(costPrice) : undefined,
        supplier,
        batchLot,
        location,
        notes,
      });

      return NextResponse.json({
        success: true,
        message: `Successfully added ${quantity} units to ${mainSku}.`,
        data: result,
      });
    }

    if (action === 'adjust') {
      const { mainSku, adjustmentType, adjustmentMode, quantity, reason, location, notes } = body;
      if (!mainSku) {
        return NextResponse.json({ success: false, message: 'Main SKU is required.' }, { status: 400 });
      }
      if (!reason) {
        return NextResponse.json({ success: false, message: 'Reason is required for inventory adjustments.' }, { status: 400 });
      }
      if (quantity === undefined || isNaN(Number(quantity))) {
        return NextResponse.json({ success: false, message: 'Valid quantity is required.' }, { status: 400 });
      }

      const result = await adjustStockTransaction(accountId, {
        mainSku,
        adjustmentType: adjustmentType || 'Adjustment',
        adjustmentMode: adjustmentMode || 'delta',
        quantity: Number(quantity),
        reason,
        location,
        notes,
      });

      return NextResponse.json({
        success: true,
        message: `Successfully adjusted stock for ${mainSku}.`,
        data: result,
      });
    }

    if (action === 'update') {
      const {
        mainSku,
        availableQuantity,
        reservedQuantity,
        reorderLevel,
        costPrice,
        location,
        reason,
        notes,
      } = body;

      if (!mainSku) {
        return NextResponse.json({ success: false, message: 'Main SKU is required.' }, { status: 400 });
      }
      if (availableQuantity === undefined || isNaN(Number(availableQuantity))) {
        return NextResponse.json({ success: false, message: 'Available Quantity is required.' }, { status: 400 });
      }

      const result = await updateInventoryRecord(accountId, {
        mainSku,
        availableQuantity: Number(availableQuantity),
        reservedQuantity: reservedQuantity !== undefined ? Number(reservedQuantity) : 0,
        reorderLevel: reorderLevel !== undefined ? Number(reorderLevel) : 10,
        costPrice: costPrice !== undefined ? Number(costPrice) : undefined,
        location,
        reason,
        notes,
      });

      return NextResponse.json({
        success: true,
        message: `Successfully updated inventory record for ${mainSku}.`,
        data: result,
      });
    }

    return NextResponse.json({ success: false, message: 'Unsupported action.' }, { status: 400 });
  } catch (error: any) {
    console.error('API Inventory Stock POST Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to process stock operation' },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/inventory/stock
 * Deletes only the inventory record for the selected SKU.
 * Product catalog entries in Products, orders, and payments are NOT deleted.
 */
export async function DELETE(request: NextRequest) {
  try {
    const accountId = request.headers.get('x-account-id');
    if (!accountId) {
      return NextResponse.json({ success: false, message: 'Account context missing' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    let mainSku = searchParams.get('mainSku');

    if (!mainSku) {
      const body = await request.json().catch(() => ({}));
      mainSku = body.mainSku;
    }

    if (!mainSku) {
      return NextResponse.json({ success: false, message: 'Main SKU is required for deletion.' }, { status: 400 });
    }

    const result = await deleteInventoryRecord(accountId, mainSku);

    return NextResponse.json({
      success: true,
      message: `Inventory record for ${mainSku} deleted successfully.`,
      data: result,
    });
  } catch (error: any) {
    console.error('API Inventory Stock DELETE Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to delete inventory record' },
      { status: 400 }
    );
  }
}
