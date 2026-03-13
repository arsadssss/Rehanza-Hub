import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/import/meesho
 * Handles Meesho report ingestion.
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
      total_rows: rows.length,
      imported: 0,
      duplicates: 0,
      failed: 0,
      errors: [] as any[]
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const externalId = String(row['Sub Order No'] || '').trim();
        const sku = String(row['SKU'] || '').trim();
        const orderDate = row['Order Date'];
        const qty = parseInt(row['Quantity']) || 1;
        const price = parseFloat(row['Supplier Listed Price (Incl. GST + Commission)']) || 0;
        const status = String(row['Reason for Credit Entry'] || 'SHIPPED');

        if (!externalId) throw new Error("Missing Sub Order No");

        // 1. Check duplicate
        const existing = await sql`SELECT id FROM orders WHERE external_order_id = ${externalId} AND account_id = ${accountId} LIMIT 1`;
        if (existing.length > 0) {
          summary.duplicates++;
          continue;
        }

        // 2. Resolve SKU
        let variantRes = await sql`SELECT id FROM product_variants WHERE variant_sku = ${sku} AND account_id = ${accountId} LIMIT 1`;
        let variantId;

        if (variantRes.length > 0) {
          variantId = variantRes[0].id;
        } else {
          const newVar = await sql`
            INSERT INTO product_variants (variant_sku, stock, account_id, created_at)
            VALUES (${sku}, 0, ${accountId}, NOW())
            RETURNING id
          `;
          variantId = newVar[0].id;
        }

        // 3. Insert Order
        await sql`
          INSERT INTO orders (order_date, platform, variant_id, quantity, selling_price, total_amount, external_order_id, status, account_id)
          VALUES (${orderDate}, 'Meesho', ${variantId}, ${qty}, ${price}, ${price * qty}, ${externalId}, ${status}, ${accountId})
        `;

        summary.imported++;
      } catch (err: any) {
        summary.failed++;
        summary.errors.push({ row: rowNum, message: err.message });
      }
    }

    return NextResponse.json({ success: true, ...summary });

  } catch (error: any) {
    console.error("MEESHO IMPORT ERROR:", error);
    return NextResponse.json({ success: false, message: "Import failed", error: error.message }, { status: 500 });
  }
}
