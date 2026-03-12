import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export const dynamic = "force-dynamic";

/**
 * Universal Marketplace Importer
 * Supports Amazon, Flipkart, Meesho
 */
export async function POST(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) return NextResponse.json({ error: "Account context missing" }, { status: 400 });

    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const fileName = file.name.toLowerCase();
    let rows: any[] = [];

    // 1. Parsing
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else {
      const text = new TextDecoder().decode(buffer);
      const isTab = text.includes('\t');
      const parseResult = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        delimiter: isTab ? "\t" : ","
      });
      rows = parseResult.data;
    }

    if (rows.length === 0) return NextResponse.json({ error: "File is empty" }, { status: 400 });

    // 2. Platform Detection
    const headers = Object.keys(rows[0]);
    let platform: "Meesho" | "Flipkart" | "Amazon" | null = null;

    if (headers.some(h => h.includes("Sub Order No"))) platform = "Meesho";
    else if (headers.some(h => h.includes("order_item_id"))) platform = "Flipkart";
    else if (headers.some(h => h.includes("order-id"))) platform = "Amazon";

    if (!platform) {
      return NextResponse.json({ error: "Unsupported report format. Could not detect marketplace." }, { status: 400 });
    }

    const summary = { imported: 0, skipped: 0, new_skus: 0, failed: 0, errors: [] as any[] };

    // 3. Row Processing
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        let ext_id = "";
        let date = "";
        let sku = "";
        let qty = 0;
        let price = 0;
        let status = "PENDING";

        if (platform === "Meesho") {
          ext_id = String(row["Sub Order No"] || "");
          date = row["Order Date"];
          sku = String(row["SKU"] || "").trim();
          qty = parseInt(row["Quantity"]) || 0;
          const priceKey = Object.keys(row).find(k => k.includes("Supplier Listed Price"));
          price = priceKey ? parseFloat(row[priceKey]) || 0 : 0;
          status = row["Reason for Credit Entry"] || "DELIVERED";
        } else if (platform === "Flipkart") {
          ext_id = String(row["order_item_id"] || "");
          date = row["order_date"];
          sku = String(row["sku"] || "").trim();
          qty = parseInt(row["quantity"]) || 0;
          price = 0;
          status = row["order_item_status"] || "SHIPPED";
        } else if (platform === "Amazon") {
          ext_id = String(row["order-id"] || "");
          date = row["purchase-date"];
          sku = String(row["sku"] || "").trim();
          qty = parseInt(row["quantity-purchased"]) || 0;
          price = parseFloat(row["item-price"]) || 0;
          status = "SHIPPED";
        }

        if (!ext_id) continue;

        // Duplicate Check
        const existing = await sql`SELECT id FROM orders WHERE external_order_id = ${ext_id} AND account_id = ${accountId} AND is_deleted = false LIMIT 1`;
        if (existing.length > 0) {
          summary.skipped++;
          continue;
        }

        // SKU Resolution
        let variantRes = await sql`SELECT id FROM product_variants WHERE variant_sku = ${sku} AND account_id = ${accountId} AND is_deleted = false LIMIT 1`;
        let variantId;

        if (variantRes.length === 0) {
          const newVariant = await sql`INSERT INTO product_variants (variant_sku, stock, account_id, low_stock_threshold) VALUES (${sku}, 0, ${accountId}, 5) RETURNING id`;
          variantId = newVariant[0].id;
          summary.new_skus++;
        } else {
          variantId = variantRes[0].id;
        }

        // Atomic Insert & Update (using separate calls to avoid statement error)
        await sql`
          INSERT INTO orders (external_order_id, order_date, platform, variant_id, quantity, selling_price, total_amount, account_id, status)
          VALUES (${ext_id}, ${date}, ${platform}, ${variantId}, ${qty}, ${price}, ${qty * price}, ${accountId}, ${status})
        `;

        await sql`
          UPDATE product_variants 
          SET stock = stock - ${qty}
          WHERE id = ${variantId} AND account_id = ${accountId}
        `;

        summary.imported++;
      } catch (err: any) {
        summary.failed++;
        summary.errors.push({ row: rowNum, msg: err.message });
      }
    }

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error("IMPORT CRITICAL ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
