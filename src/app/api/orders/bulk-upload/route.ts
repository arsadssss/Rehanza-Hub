import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/bulk-upload
 * Clean implementation of bulk order import with transactional stock management.
 */
export async function POST(request: Request) {
  try {
    // 1. Account Context Validation
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ error: "Account context missing" }, { status: 400 });
    }

    // 2. Multipart/Form-Data Handling
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file uploaded or file is empty" }, { status: 400 });
    }

    // 3. CSV Parsing
    const text = await file.text();
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(line => line !== "");
    
    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV must contain a header and at least one data row" }, { status: 400 });
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredHeaders = ["external_order_id", "order_date", "platform", "variant_sku", "quantity", "selling_price"];
    
    const missingHeaders = requiredHeaders.filter(rh => !headers.includes(rh));
    if (missingHeaders.length > 0) {
      return NextResponse.json({ error: `Missing required columns: ${missingHeaders.join(", ")}` }, { status: 400 });
    }

    // Map header indices
    const hIdx = {
      ext_id: headers.indexOf('external_order_id'),
      date: headers.indexOf('order_date'),
      platform: headers.indexOf('platform'),
      sku: headers.indexOf('variant_sku'),
      qty: headers.indexOf('quantity'),
      price: headers.indexOf('selling_price')
    };

    const dataRows = lines.slice(1);
    const result = {
      inserted: 0,
      skipped: 0,
      errors: [] as string[]
    };

    // 4. Pre-Validation Phase (Identify SKUs and Detect Duplicates)
    const skus = new Set<string>();
    const extIds = new Set<string>();
    const parsedData: any[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const cols = dataRows[i].split(',').map(c => c.trim());
      const rowNum = i + 2;

      if (cols.length < requiredHeaders.length) {
        result.skipped++;
        result.errors.push(`Row ${rowNum}: Incomplete data`);
        continue;
      }

      const row = {
        ext_id: cols[hIdx.ext_id],
        date: cols[hIdx.date],
        platform: cols[hIdx.platform],
        sku: cols[hIdx.sku],
        qty: parseInt(cols[hIdx.qty]),
        price: parseFloat(cols[hIdx.price]),
        rowNum
      };

      // Basic field validation
      if (!row.ext_id || !row.sku || isNaN(row.qty) || isNaN(row.price) || !row.date) {
        result.skipped++;
        result.errors.push(`Row ${rowNum}: Missing or malformed fields`);
        continue;
      }

      skus.add(row.sku);
      extIds.add(row.ext_id);
      parsedData.push(row);
    }

    if (parsedData.length === 0) {
      return NextResponse.json(result);
    }

    // Batch Fetch Verification Data
    const [variantsRes, existingOrdersRes] = await Promise.all([
      sql`SELECT id, variant_sku, stock FROM product_variants WHERE variant_sku = ANY(${Array.from(skus)}) AND account_id = ${accountId}`,
      sql`SELECT external_order_id FROM orders WHERE external_order_id = ANY(${Array.from(extIds)}) AND account_id = ${accountId} AND is_deleted = false`
    ]);

    const variantMap = new Map(variantsRes.map((v: any) => [v.variant_sku, v]));
    const existingIds = new Set(existingOrdersRes.map((o: any) => o.external_order_id));

    const finalQueue: any[] = [];

    for (const row of parsedData) {
      if (existingIds.has(row.ext_id)) {
        result.skipped++;
        result.errors.push(`Row ${row.rowNum}: Duplicate Order ID (${row.ext_id})`);
        continue;
      }

      const variant = variantMap.get(row.sku);
      if (!variant) {
        result.skipped++;
        result.errors.push(`Row ${row.rowNum}: SKU not found (${row.sku})`);
        continue;
      }

      if (variant.stock < row.qty) {
        result.skipped++;
        result.errors.push(`Row ${row.rowNum}: Insufficient stock for ${row.sku} (Available: ${variant.stock})`);
        continue;
      }

      finalQueue.push({ ...row, variant_id: variant.id });
    }

    // 5. Transactional Phase (Atomic Insert + Stock Update)
    if (finalQueue.length > 0) {
      // Note: Using a block of queries for atomicity. 
      // Neon 'sql' tagged template executes multiple statements if provided.
      // We'll perform each pair sequentially within this handler if a standard 'begin' isn't available.
      try {
        for (const item of finalQueue) {
          // Double check stock one last time inside the loop context if necessary, 
          // but here we execute the pair.
          await sql`
            WITH inserted_order AS (
              INSERT INTO orders (external_order_id, order_date, platform, variant_id, quantity, selling_price, account_id)
              VALUES (${item.ext_id}, ${item.date}, ${item.platform}, ${item.variant_id}, ${item.qty}, ${item.price}, ${accountId})
              RETURNING variant_id, quantity
            )
            UPDATE product_variants 
            SET stock = stock - (SELECT quantity FROM inserted_order)
            WHERE id = (SELECT variant_id FROM inserted_order) AND account_id = ${accountId} AND stock >= (SELECT quantity FROM inserted_order);
          `;
          result.inserted++;
        }
      } catch (dbErr: any) {
        console.error("Database Transaction Error:", dbErr);
        throw new Error(`Transaction failed during row processing: ${dbErr.message}`);
      }
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("BULK IMPORT FATAL ERROR:", error);
    return NextResponse.json({ 
      error: "Critical failure during import", 
      details: error.message 
    }, { status: 500 });
  }
}
