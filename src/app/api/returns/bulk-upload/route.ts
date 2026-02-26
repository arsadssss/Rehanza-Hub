import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

/**
 * POST /api/returns/bulk-upload
 * Processes a CSV file to bulk import returns and restock inventory.
 * Strictly scoped by x-account-id.
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
    const requiredHeaders = ["external_return_id", "return_date", "platform", "variant_sku", "quantity", "refund_amount"];
    
    const missingHeaders = requiredHeaders.filter(rh => !headers.includes(rh));
    if (missingHeaders.length > 0) {
      return NextResponse.json({ error: `Missing required columns: ${missingHeaders.join(", ")}` }, { status: 400 });
    }

    const hIdx = {
      ext_id: headers.indexOf('external_return_id'),
      date: headers.indexOf('return_date'),
      platform: headers.indexOf('platform'),
      sku: headers.indexOf('variant_sku'),
      qty: headers.indexOf('quantity'),
      refund: headers.indexOf('refund_amount')
    };

    const dataRows = lines.slice(1);
    const result = {
      inserted: 0,
      skipped: 0,
      errors: [] as string[]
    };

    // 4. Pre-Validation Phase
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
        refund: parseFloat(cols[hIdx.refund]),
        rowNum
      };

      if (!row.ext_id || !row.sku || isNaN(row.qty) || isNaN(row.refund) || !row.date) {
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
    const [variantsRes, existingReturnsRes] = await Promise.all([
      sql`SELECT id, variant_sku, stock FROM product_variants WHERE variant_sku = ANY(${Array.from(skus)}) AND account_id = ${accountId}`,
      sql`SELECT external_return_id FROM returns WHERE external_return_id = ANY(${Array.from(extIds)}) AND account_id = ${accountId} AND is_deleted = false`
    ]);

    const variantMap = new Map(variantsRes.map((v: any) => [v.variant_sku, v]));
    const existingIds = new Set(existingReturnsRes.map((r: any) => r.external_return_id));

    const finalQueue: any[] = [];

    for (const row of parsedData) {
      if (existingIds.has(row.ext_id)) {
        result.skipped++;
        result.errors.push(`Row ${row.rowNum}: Duplicate Return ID (${row.ext_id})`);
        continue;
      }

      const variant = variantMap.get(row.sku);
      if (!variant) {
        result.skipped++;
        result.errors.push(`Row ${row.rowNum}: SKU not found (${row.sku})`);
        continue;
      }

      finalQueue.push({ ...row, variant_id: variant.id });
    }

    // 5. Transactional Phase (Atomic Insert + Stock Restock)
    if (finalQueue.length > 0) {
      try {
        for (const item of finalQueue) {
          // Note: total_loss is calculated from refund or set to 0 if schema requires. 
          // Assuming schema uses total_loss for dashboard reporting.
          await sql`
            WITH inserted_return AS (
              INSERT INTO returns (external_return_id, return_date, platform, variant_id, quantity, refund_amount, account_id, restockable)
              VALUES (${item.ext_id}, ${item.date}, ${item.platform}, ${item.variant_id}, ${item.qty}, ${item.refund}, ${accountId}, true)
              RETURNING variant_id, quantity
            )
            UPDATE product_variants 
            SET stock = stock + (SELECT quantity FROM inserted_return)
            WHERE id = (SELECT variant_id FROM inserted_return) AND account_id = ${accountId};
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
    console.error("BULK RETURN IMPORT FATAL ERROR:", error);
    return NextResponse.json({ 
      error: "Critical failure during return import", 
      details: error.message 
    }, { status: 500 });
  }
}
