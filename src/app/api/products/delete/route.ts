import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * DELETE /api/products/delete
 * Soft deletes a product by SKU for the active account.
 */
export async function DELETE(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    const body = await request.json();
    const { sku } = body;

    if (!sku) {
      return NextResponse.json({ success: false, message: "SKU is required" }, { status: 400 });
    }

    const result = await sql`
      UPDATE allproducts 
      SET is_deleted = true 
      WHERE sku = ${sku} AND account_id = ${accountId}
      RETURNING sku;
    `;

    if (result.length === 0) {
      return NextResponse.json({ success: false, message: "Product not found or access denied" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Product deleted successfully" });
  } catch (error: any) {
    console.error("API Products Delete Error:", error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || "Failed to delete product" 
    }, { status: 500 });
  }
}
