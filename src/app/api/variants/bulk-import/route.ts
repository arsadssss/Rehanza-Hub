
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = "force-dynamic";

/**
 * POST /api/variants/bulk-import
 * Isolated service for batch inventory (variant) management.
 * Maps CSV "Product SKU" to internal "product_id".
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const accountId = request.headers.get("x-account-id");

    if (!session || !session.user?.id || !accountId) {
      return NextResponse.json({ success: false, message: "Unauthorized or Account ID missing." }, { status: 401 });
    }

    const { variants } = await request.json();
    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      return NextResponse.json({ success: false, message: "Empty dataset received." }, { status: 400 });
    }

    // 1. Fetch ALL products for this account to map SKU -> ID
    const productsRes = await sql`
      SELECT id, sku FROM allproducts 
      WHERE account_id = ${accountId} AND is_deleted = false
    `;
    const productMap = new Map(productsRes.map((p: any) => [p.sku.toUpperCase(), p.id]));

    // 2. Fetch existing variants for this account to partition Insert vs Update
    const existingVariantsRes = await sql`
      SELECT id, variant_sku FROM product_variants 
      WHERE account_id = ${accountId} AND is_deleted = false
    `;
    const existingVariantMap = new Set(existingVariantsRes.map((v: any) => v.variant_sku.toUpperCase()));

    const toInsert: any[] = [];
    const toUpdate: any[] = [];
    let invalidProductSkuCount = 0;

    // 3. Process and Validate
    for (const v of variants) {
      const prodSku = v.product_sku.trim().toUpperCase();
      const variantSku = v.variant_sku.trim().toUpperCase();
      const productId = productMap.get(prodSku);

      if (!productId) {
        invalidProductSkuCount++;
        continue;
      }

      const preparedItem = {
        product_id: productId,
        variant_sku: variantSku,
        color: v.color || null,
        size: v.size || null,
        stock: parseInt(v.stock) || 0,
        account_id: accountId
      };

      if (existingVariantMap.has(variantSku)) {
        toUpdate.push(preparedItem);
      } else {
        toInsert.push(preparedItem);
      }
    }

    let inserted = 0;
    let updated = 0;

    // 4. Transactional Block
    // Manual loop for updates and batch insert for new records
    if (toInsert.length > 0) {
      for (const item of toInsert) {
        await sql`
          INSERT INTO product_variants (product_id, variant_sku, color, size, stock, account_id, low_stock_threshold)
          VALUES (${item.product_id}, ${item.variant_sku}, ${item.color}, ${item.size}, ${item.stock}, ${accountId}, 5)
        `;
        inserted++;
      }
    }

    if (toUpdate.length > 0) {
      for (const item of toUpdate) {
        await sql`
          UPDATE product_variants 
          SET 
            product_id = ${item.product_id},
            color = ${item.color},
            size = ${item.size},
            stock = ${item.stock}
          WHERE account_id = ${accountId} 
          AND variant_sku = ${item.variant_sku}
          AND is_deleted = false
        `;
        updated++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      total_rows: variants.length,
      inserted,
      updated,
      invalid_product_sku: invalidProductSkuCount,
      message: `Import complete: ${inserted} inserted, ${updated} updated.`
    });

  } catch (error: any) {
    console.error("VARIANT BULK IMPORT ERROR:", error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || "An error occurred during variant processing." 
    }, { status: 500 });
  }
}
