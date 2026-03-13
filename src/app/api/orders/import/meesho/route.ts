import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/import/meesho
 * Handles bulk import of Meesho order reports.
 * 1. Parses XLSX/CSV
 * 2. Checks for existing orders (external_order_id)
 * 3. Resolves/Creates missing SKUs (with uniqueness check)
 * 4. Inserts orders sequentially with error recovery
 */
export async function POST(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account not selected" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ success: false, message: "No file uploaded" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    const summary = {
      processed: 0,
      imported: 0,
      duplicates: 0,
      failed: 0,
      new_skus: 0,
      errors: [] as any[]
    };

    if (rows.length === 0) return NextResponse.json({ success: true, ...summary });

    // Cache SKU lookups in memory to prevent duplicate DB hits and UNIQUE constraint errors
    const skuCache = new Map<string, string>();

    for (let i = 0; i < rows.length; i++) {
      summary.processed++;
      const row = rows[i];
      const rowNum = i + 2; // +1 for header, +1 for 0-index

      try {
        const externalId = String(row['Sub Order No'] || '').trim();
        const skuRaw = String(row['SKU'] || '').trim();
        const sku = skuRaw.toUpperCase();
        const orderDateRaw = row['Order Date'];
        const qty = parseInt(row['Quantity']) || 1;
        const price = parseFloat(row['Supplier Listed Price (Incl. GST + Commission)']) || 0;
        const status = String(row['Reason for Credit Entry'] || 'SHIPPED').trim();

        if (!externalId) {
          throw new Error("Missing 'Sub Order No'");
        }

        // 1. Check for existing order to prevent duplicates
        const existingOrder = await sql`
          SELECT id FROM orders 
          WHERE external_order_id = ${externalId} AND account_id = ${accountId} AND is_deleted = false
          LIMIT 1
        `;

        if (existingOrder.length > 0) {
          summary.duplicates++;
          continue;
        }

        // 2. Resolve Variant ID (Check Cache -> Check DB -> Create)
        let variantId = skuCache.get(sku);

        if (!variantId && sku) {
          // Check DB for existing variant
          const dbVariant = await sql`
            SELECT id FROM product_variants 
            WHERE variant_sku = ${sku} AND account_id = ${accountId}
            LIMIT 1
          `;

          if (dbVariant.length > 0) {
            variantId = dbVariant[0].id;
          } else {
            // Create new variant
            const newVar = await sql`
              INSERT INTO product_variants (variant_sku, stock, account_id, low_stock_threshold, created_at)
              VALUES (${sku}, 0, ${accountId}, 5, NOW())
              RETURNING id
            `;
            variantId = newVar[0].id;
            summary.new_skus++;
          }
          
          if (variantId) {
            skuCache.set(sku, variantId);
          }
        }

        if (!variantId) {
          throw new Error(`SKU "${sku}" could not be resolved.`);
        }

        // 3. Handle Date Parsing
        let orderDate = orderDateRaw;
        if (typeof orderDateRaw === 'number') {
          // XLSX serial date conversion
          orderDate = XLSX.utils.format_cell({ v: orderDateRaw, t: 'd' });
        }

        // 4. Atomic Insert
        await sql`
          INSERT INTO orders (
            order_date, platform, variant_id, quantity, 
            selling_price, total_amount, external_order_id, 
            status, account_id
          )
          VALUES (
            ${orderDate}, 'Meesho', ${variantId}, ${qty},
            ${price}, ${price * qty}, ${externalId},
            ${status}, ${accountId}
          )
        `;

        summary.imported++;
      } catch (err: any) {
        summary.failed++;
        summary.errors.push({ row: rowNum, message: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      ...summary
    });

  } catch (error: any) {
    console.error("MEESHO IMPORT ERROR:", error);
    return NextResponse.json({ success: false, message: "Import failed", error: error.message }, { status: 500 });
  }
}
