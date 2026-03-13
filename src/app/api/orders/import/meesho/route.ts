
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/import/meesho
 * Handles bulk import of Meesho order reports.
 * 1. Parses XLSX/CSV
 * 2. Checks for existing orders (external_order_id)
 * 3. Resolves/Creates missing SKUs
 * 4. Inserts orders in batch
 */
export async function POST(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) return NextResponse.json({ message: "Account not selected" }, { status: 400 });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ message: "No file uploaded" }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    const summary = {
      total_rows: rows.length,
      imported: 0,
      duplicates: 0,
      failed: 0,
      errors: [] as any[]
    };

    if (rows.length === 0) return NextResponse.json(summary);

    // 1. Bulk Fetch Existing External IDs to skip duplicates
    const extIds = rows.map(r => String(r['Sub Order No'] || '')).filter(Boolean);
    const existingRes = await sql`
      SELECT external_order_id FROM orders 
      WHERE external_order_id = ANY(${extIds}) AND account_id = ${accountId} AND is_deleted = false
    `;
    const existingIdSet = new Set(existingRes.map((r: any) => r.external_order_id));

    // 2. Bulk Fetch Variants mapping for resolution
    const skus = Array.from(new Set(rows.map(r => String(r['SKU'] || '').trim()).filter(Boolean)));
    const variantsRes = await sql`
      SELECT id, variant_sku FROM product_variants 
      WHERE variant_sku = ANY(${skus}) AND account_id = ${accountId} AND is_deleted = false
    `;
    const variantMap = new Map(variantsRes.map((v: any) => [v.variant_sku.toUpperCase(), v.id]));

    // 3. Process Rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const externalId = String(row['Sub Order No'] || '').trim();
      const sku = String(row['SKU'] || '').trim().toUpperCase();
      const orderDateRaw = row['Order Date'];
      const qty = parseInt(row['Quantity']) || 1;
      const price = parseFloat(row['Supplier Listed Price (Incl. GST + Commission)']) || 0;
      const status = String(row['Reason for Credit Entry'] || 'SHIPPED').trim();

      if (!externalId) {
        summary.failed++;
        summary.errors.push({ row: i + 2, message: "Missing Sub Order No" });
        continue;
      }

      if (existingIdSet.has(externalId)) {
        summary.duplicates++;
        continue;
      }

      try {
        let variantId = variantMap.get(sku);

        // Auto-create missing variant
        if (!variantId && sku) {
          const newVar = await sql`
            INSERT INTO product_variants (variant_sku, stock, account_id, low_stock_threshold)
            VALUES (${sku}, 0, ${accountId}, 5)
            RETURNING id
          `;
          variantId = newVar[0].id;
          variantMap.set(sku, variantId);
        }

        if (!variantId) {
          summary.failed++;
          summary.errors.push({ row: i + 2, message: `SKU ${sku} could not be resolved` });
          continue;
        }

        // Parse date (XLSX serial or string)
        let orderDate = orderDateRaw;
        if (typeof orderDateRaw === 'number') {
          const d = XLSX.utils.format_cell({ v: orderDateRaw, t: 'd' });
          orderDate = d;
        }

        // Atomic Insert
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
        summary.errors.push({ row: i + 2, message: err.message });
      }
    }

    return NextResponse.json(summary);

  } catch (error: any) {
    console.error("MEESHO IMPORT ERROR:", error);
    return NextResponse.json({ message: "Import failed", error: error.message }, { status: 500 });
  }
}
