import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const dynamic = "force-dynamic";

// Configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['xlsx', 'csv', 'tsv'];
const BATCH_SIZE = 50;

/**
 * POST /api/orders/import/meesho
 * Rebuilt Meesho Order Importer with batching and inventory sync.
 */
export async function POST(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ error: "Account context missing" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      return NextResponse.json({ error: "Invalid file type. Only .xlsx, .csv, and .tsv are supported." }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(Buffer.from(buffer), { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet) as any[];

    if (rows.length === 0) {
      return NextResponse.json({ error: "The file is empty" }, { status: 400 });
    }

    const summary = {
      total_rows: rows.length,
      imported: 0,
      duplicates: 0,
      failed: 0,
      new_skus: 0, // Keeping for structural compatibility, but prompt asked to skip if not found
      errors: [] as any[]
    };

    // Process in batches
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      
      for (const row of batch) {
        const rowNum = i + rows.indexOf(row) + 2;
        
        try {
          // Flexible mapping for headers
          const extId = String(row["Sub Order No"] || "").trim();
          const orderDate = row["Order Date"];
          const sku = String(row["SKU"] || "").trim();
          const quantity = parseInt(row["Quantity"]) || 0;
          const sellingPrice = parseFloat(row["Supplier Listed Price (Incl. GST + Commission)"]) || 0;
          const rawStatus = String(row["Reason for Credit Entry"] || "SHIPPED").toUpperCase();

          if (!extId || !sku) {
            throw new Error("Missing Sub Order No or SKU");
          }

          // 1. Duplicate Check
          const existing = await sql`
            SELECT id FROM orders 
            WHERE external_order_id = ${extId} 
            AND account_id = ${accountId} 
            AND is_deleted = false 
            LIMIT 1
          `;
          if (existing.length > 0) {
            summary.duplicates++;
            continue;
          }

          // 2. Resolve Variant
          const variantRes = await sql`
            SELECT id, stock FROM product_variants 
            WHERE variant_sku = ${sku} 
            AND account_id = ${accountId} 
            AND is_deleted = false 
            LIMIT 1
          `;
          
          if (variantRes.length === 0) {
            throw new Error(`SKU "${sku}" not found in inventory`);
          }

          const variantId = variantRes[0].id;

          // 3. Status Mapping
          let finalStatus = "SHIPPED";
          if (rawStatus.includes("DELIVERED")) finalStatus = "DELIVERED";
          if (rawStatus.includes("CANCELLED")) finalStatus = "CANCELLED";
          if (rawStatus.includes("READY_TO_SHIP")) finalStatus = "READY_TO_SHIP";

          // 4. Insert Order
          await sql`
            INSERT INTO orders (
              order_date, platform, variant_id, quantity, selling_price, 
              total_amount, external_order_id, status, account_id
            )
            VALUES (
              ${orderDate}, 'Meesho', ${variantId}, ${quantity}, ${sellingPrice}, 
              ${quantity * sellingPrice}, ${extId}, ${finalStatus}, ${accountId}
            )
          `;

          // 5. Update Inventory
          await sql`
            UPDATE product_variants 
            SET stock = stock - ${quantity}
            WHERE id = ${variantId} AND account_id = ${accountId}
          `;

          summary.imported++;
        } catch (err: any) {
          summary.failed++;
          if (summary.errors.length < 20) {
            summary.errors.push({ row: rowNum, message: err.message });
          }
        }
      }
    }

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error("MEESHO IMPORT CRITICAL ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
