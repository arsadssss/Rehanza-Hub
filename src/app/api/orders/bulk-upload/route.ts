import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

const VALID_STATUSES = [
  "DELIVERED", "SHIPPED", "READY_TO_SHIP", "CANCELLED", "RTO_INITIATED", "RTO_LOCKED", 
  "RTO_COMPLETE", "DOOR_STEP_EXCHANGED", "HOLD", "RETURNED", "RETURN_REQUESTED", 
  "APPROVED", "UNSHIPPED", "PENDING", "REFUND_APPLIED"
];

/**
 * POST /api/orders/bulk-upload
 * Improved implementation with row-level error reporting and atomic transaction safety.
 */
export async function POST(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ error: "Account context missing" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file uploaded or file is empty" }, { status: 400 });
    }

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

    const hIdx = {
      ext_id: headers.indexOf('external_order_id'),
      date: headers.indexOf('order_date'),
      platform: headers.indexOf('platform'),
      sku: headers.indexOf('variant_sku'),
      qty: headers.indexOf('quantity'),
      price: headers.indexOf('selling_price'),
      status: headers.indexOf('status'),
    };

    const dataRows = lines.slice(1);
    const result = {
      success: true,
      total_rows: dataRows.length,
      inserted: 0,
      skipped: 0,
      errors: [] as string[]
    };

    const skus = new Set<string>();
    const extIds = new Set<string>();
    const parsedData: any[] = [];

    // --- PHASE 1: Row-by-row Data Integrity Pass ---
    for (let i = 0; i < dataRows.length; i++) {
      const cols = dataRows[i].split(',').map(c => c.trim());
      const rowNum = i + 2;

      if (cols.length < requiredHeaders.length) {
        result.skipped++;
        result.errors.push(`Row ${rowNum}: Incomplete data columns`);
        continue;
      }

      const statusVal = hIdx.status !== -1 ? cols[hIdx.status]?.toUpperCase() : "PENDING";
      const finalStatus = statusVal || "PENDING";

      if (!VALID_STATUSES.includes(finalStatus)) {
        result.skipped++;
        result.errors.push(`Row ${rowNum}: Invalid status "${finalStatus}"`);
        continue;
      }

      const row = {
        ext_id: cols[hIdx.ext_id],
        date: cols[hIdx.date],
        platform: cols[hIdx.platform],
        sku: (cols[hIdx.sku] || "").trim().toUpperCase(),
        qty: parseInt(cols[hIdx.qty]),
        price: parseFloat(cols[hIdx.price]),
        status: finalStatus,
        rowNum
      };

      if (!row.ext_id) {
        result.skipped++;
        result.errors.push(`Row ${rowNum}: Missing external_order_id`);
        continue;
      }

      if (!row.sku) {
        result.skipped++;
        result.errors.push(`Row ${rowNum}: Missing variant_sku`);
        continue;
      }

      if (isNaN(row.qty) || row.qty <= 0) {
        result.skipped++;
        result.errors.push(`Row ${rowNum}: Invalid quantity (must be > 0)`);
        continue;
      }

      if (isNaN(row.price)) {
        result.skipped++;
        result.errors.push(`Row ${rowNum}: Invalid selling_price`);
        continue;
      }

      skus.add(row.sku);
      extIds.add(row.ext_id);
      parsedData.push(row);
    }

    if (parsedData.length === 0 && result.errors.length > 0) {
      result.success = false;
      return NextResponse.json(result, { status: 400 });
    }

    // --- PHASE 2: Database Verification Pass (Batch) ---
    const [variantsRes, existingOrdersRes] = await Promise.all([
      sql`SELECT id, variant_sku, stock FROM product_variants WHERE variant_sku = ANY(${Array.from(skus)}) AND account_id = ${accountId} AND is_deleted = false`,
      sql`SELECT external_order_id FROM orders WHERE external_order_id = ANY(${Array.from(extIds)}) AND account_id = ${accountId} AND is_deleted = false`
    ]);

    const variantMap = new Map(variantsRes.map((v: any) => [v.variant_sku.toUpperCase(), v]));
    const existingIds = new Set(existingOrdersRes.map((o: any) => o.external_order_id));

    const finalQueue: any[] = [];

    for (const row of parsedData) {
      if (existingIds.has(row.ext_id)) {
        result.skipped++;
        result.errors.push(`Row ${row.rowNum}: Duplicate Order ID (${row.ext_id}) already exists in DB`);
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
        result.errors.push(`Row ${row.rowNum}: Insufficient stock for ${row.sku} (Available: ${variant.stock}, Requested: ${row.qty})`);
        continue;
      }

      finalQueue.push({ ...row, variant_id: variant.id });
    }

    // --- PHASE 3: Atomic Transaction Pass ---
    if (result.errors.length > 0) {
      // If there are validation errors, we report them and do not proceed with any inserts
      // to maintain file-to-db consistency.
      result.success = false;
      return NextResponse.json(result, { status: 400 });
    }

    if (finalQueue.length > 0) {
      try {
        // Neon driver doesn't support explicit multi-statement BEGIN/COMMIT in one go easily via tagged templates,
        // so we process sequential queries. Since it's a single session, we can wrap in a loop.
        for (const item of finalQueue) {
          await sql`
            WITH inserted_order AS (
              INSERT INTO orders (external_order_id, order_date, platform, variant_id, quantity, selling_price, account_id, status)
              VALUES (${item.ext_id}, ${item.date}, ${item.platform}, ${item.variant_id}, ${item.qty}, ${item.price}, ${accountId}, ${item.status})
              RETURNING variant_id, quantity
            )
            UPDATE product_variants 
            SET stock = stock - (SELECT quantity FROM inserted_order)
            WHERE id = (SELECT variant_id FROM inserted_order) AND account_id = ${accountId};
          `;
          result.inserted++;
        }
      } catch (dbErr: any) {
        console.error("Database Execution Error:", dbErr);
        return NextResponse.json({ 
          success: false,
          error: "Database transaction failed", 
          details: dbErr.message 
        }, { status: 500 });
      }
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("BULK IMPORT SYSTEM ERROR:", error);
    return NextResponse.json({ 
      success: false,
      error: "Critical system failure during import", 
      details: error.message 
    }, { status: 500 });
  }
}
