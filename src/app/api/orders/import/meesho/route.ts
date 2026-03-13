import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) return NextResponse.json({ error: "Account missing" }, { status: 400 });

    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];

    if (rows.length === 0) return NextResponse.json({ error: "Empty file" }, { status: 400 });

    const summary = {
      total_rows: rows.length,
      imported: 0,
      duplicates: 0,
      new_skus: 0,
      failed: 0,
      errors: [] as any[]
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const extId = String(row["Sub Order No"] || "").trim();
        const sku = String(row["SKU"] || "").trim();
        const orderDate = row["Order Date"];
        const qty = parseInt(row["Quantity"]) || 0;
        const sellingPrice = parseFloat(row["Supplier Listed Price (Incl. GST + Commission)"]) || 0;
        const status = row["Reason for Credit Entry"] || "SHIPPED";

        if (!extId || !sku) {
          summary.failed++;
          summary.errors.push({ row: rowNum, message: "Missing Order ID or SKU" });
          continue;
        }

        // 1. Duplicate Check
        const existing = await sql`SELECT id FROM orders WHERE external_order_id = ${extId} AND account_id = ${accountId} AND is_deleted = false LIMIT 1`;
        if (existing.length > 0) {
          summary.duplicates++;
          continue;
        }

        // 2. Resolve Variant
        let variantRes = await sql`SELECT id FROM product_variants WHERE variant_sku = ${sku} AND account_id = ${accountId} AND is_deleted = false LIMIT 1`;
        let variantId;

        if (variantRes.length === 0) {
          const newVar = await sql`
            INSERT INTO product_variants (variant_sku, stock, account_id, low_stock_threshold) 
            VALUES (${sku}, 0, ${accountId}, 5) 
            RETURNING id
          `;
          variantId = newVar[0].id;
          summary.new_skus++;
        } else {
          variantId = variantRes[0].id;
        }

        // 3. Insert Order
        await sql`
          INSERT INTO orders (
            order_date, platform, variant_id, quantity, selling_price, 
            total_amount, external_order_id, status, account_id
          )
          VALUES (
            ${orderDate}, 'Meesho', ${variantId}, ${qty}, ${sellingPrice}, 
            ${qty * sellingPrice}, ${extId}, ${status}, ${accountId}
          )
        `;

        summary.imported++;
      } catch (err: any) {
        summary.failed++;
        summary.errors.push({ row: rowNum, message: err.message });
      }
    }

    return NextResponse.json(summary);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
