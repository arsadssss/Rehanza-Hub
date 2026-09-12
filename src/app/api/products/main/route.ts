import { NextRequest, NextResponse } from 'next/server';
import { createMainProduct, getMainProducts } from '@/lib/products/sku-registry-service';

export const revalidate = 0;

/**
 * GET /api/products/main
 * Returns all Main Products for the active account.
 */
export async function GET(request: NextRequest) {
  const accountId = request.headers.get('x-account-id');
  if (!accountId) {
    return NextResponse.json({ success: false, message: 'Account context missing' }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const data = await getMainProducts(accountId, search);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('API Products Main GET Error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to fetch main products' }, { status: 500 });
  }
}

/**
 * POST /api/products/main
 * Creates a new Main Product.
 */
export async function POST(request: NextRequest) {
  const accountId = request.headers.get('x-account-id');
  if (!accountId) {
    return NextResponse.json({ success: false, message: 'Account context missing' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { name, mainSku, category, description } = body;

    if (!name || !mainSku) {
      return NextResponse.json(
        { success: false, message: 'Product name and Main SKU code are required' },
        { status: 400 }
      );
    }

    const newProduct = await createMainProduct(accountId, {
      name: name.trim(),
      mainSku: mainSku.trim(),
      category: category?.trim() || null,
      description: description?.trim() || null,
    });

    return NextResponse.json({ success: true, data: newProduct }, { status: 201 });
  } catch (error: any) {
    console.error('API Products Main POST Error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to create main product' }, { status: 500 });
  }
}

