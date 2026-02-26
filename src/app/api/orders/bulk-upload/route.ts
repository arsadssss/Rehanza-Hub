import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow 1 minute for large imports

/**
 * POST /api/orders/bulk-upload
 * Robust CSV import with defensive parsing and safe-mode validation.
 */
export async function POST(request: Request) {
  try {
    // 1. Validate Account Context
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ 
        success: false, 
        error: "Account context missing (x-account-id header)" 
      }, { status: 400 });
    }

    // 2. Extract Form Data safely
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (err: any) {
      console.error("FormData parsing failed:", err);
      return NextResponse.json({ 
        success: false, 
        error: "Invalid request format. Expected multipart/form-data.",
        details: err.message
      }, { status: 400 });
    }

    // 3. Extract and Validate File
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ success: false, error: "Uploaded file is empty" }, { status: 400 });
    }

    // 4. Read and Validate Raw Text
    const text = await file.text();
    if (!text || text.trim().length === 0) {
      return NextResponse.json({ success: false, error: "CSV file contains no data" }, { status: 400 });
    }

    // 5. Parse Lines and Headers
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length < 2) {
      return NextResponse.json({ success: false, error: "CSV must contain a header row and at least one data row" }, { status: 400 });
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredHeaders = [
      "external_order_id",
      "order_date",
      "platform",
      "variant_sku",
      "quantity",
      "selling_price"
    ];

    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: `Missing required columns: ${missingHeaders.join(", ")}` 
      }, { status: 400 });
    }

    // Map header indices
    const hIdx = {
      external_id: headers.indexOf('external_order_id'),
      date: headers.indexOf('order_date'),
      platform: headers.indexOf('platform'),
      sku: headers.indexOf('variant_sku'),
      qty: headers.indexOf('quantity'),
      price: headers.indexOf('selling_price')
    };

    const dataRows = lines.slice(1);
    const errors: any[] = [];
    const parsedRows: any[] = [];
    const skusToResolve = new Set<string>();
    const externalIdsToCheck = new Set<string>();

    // 6. Safe Validation Loop (Phase 1: Basic structural check)
    for (let i = 0; i < dataRows.length; i++) {
      const columns = dataRows[i].split(',').map(c => c.trim());
      const rowNum = i + 2;

      if (columns.length < requiredHeaders.length) {
        errors.push({ row: rowNum, reason: "Incomplete data row" });
        continue;
      }

      const extId = columns[hIdx.external_id];
      const date = columns[hIdx.date];
      const platform = columns[hIdx.platform];
      const sku = columns[hIdx.sku];
      const qty = parseInt(columns[hIdx.qty]);
      const price = parseFloat(columns[hIdx.price]);

      if (!extId || !sku || !date || !platform || isNaN(qty) || isNaN(price)) {
        errors.push({ row: rowNum, reason: "Missing or malformed required fields" });
        continue;
      }

      const validPlatforms = ['Amazon', 'Flipkart', 'Meesho'];
      if (!validPlatforms.includes(platform)) {
        errors.push({ row: rowNum, reason: `Invalid platform: ${platform}. Must be one of: ${validPlatforms.join(', ')}` });
        continue;
      }

      parsedRows.push({
        external_order_id: extId,
        order_date: date,
        platform,
        variant_sku: sku,
        quantity: qty,
        selling_price: price,
        rowNumber: rowNum
      });

      skusToResolve.add(sku);
      externalIdsToCheck.add(extId);
    }

    if (parsedRows.length === 0) {
      return NextResponse.json({ 
        totalRows: dataRows.length,
        inserted: 0,
        failed: errors.length,
        errors 
      });
    }

    // 7. Batch Fetch Validation Data
    const [variantsRes, existingOrdersRes] = await Promise.all([
      sql`SELECT id, variant_sku, stock FROM product_variants WHERE variant_sku = ANY(${Array.from(skusToResolve)}) AND account_id = ${accountId}`,
      sql`SELECT external_order_id FROM orders WHERE external_order_id = ANY(${Array.from(externalIdsToCheck)}) AND account_id = ${accountId} AND is_deleted = false`
    ]);

    const variantMap = new Map(variantsRes.map((v: any) => [v.variant_sku, v]));
    const existingIds = new Set(existingOrdersRes.map((o: any) => o.external_order_id));

    const validatedRows: any[] = [];
    let duplicateCount = 0;
    let stockErrorCount = 0;

    // 8. Safe Validation Loop (Phase 2: Business logic)
    for (const row of parsedRows) {
      if (existingIds.has(row.external_order_id)) {
        errors.push({ row: row.rowNumber, reason: `Duplicate external_order_id: ${row.external_order_id}` });
        duplicateCount++;
        continue;
      }

      const variant = variantMap.get(row.variant_sku);
      if (!variant) {
        errors.push({ row: row.rowNumber, reason: `SKU not found: ${row.variant_sku}` });
        continue;
      }

      if (variant.stock < row.quantity) {
        errors.push({ row: row.rowNumber, reason: `Insufficient stock for ${row.variant_sku}. Available: ${variant.stock}, Requested: ${row.quantity}` });
        stockErrorCount++;
        continue;
      }

      validatedRows.push({
        ...row,
        variant_id: variant.id,
        total_amount: row.quantity * row.selling_price
      });
      
      variant.stock -= row.quantity;
    }

    // 9. Database Transaction Phase
    if (validatedRows.length > 0) {
      const work = async (tx: any) => {
        for (const row of validatedRows) {
          await tx`
            INSERT INTO orders (
              external_order_id, order_date, platform, variant_id, 
              quantity, selling_price, total_amount, account_id
            ) VALUES (
              ${row.external_order_id}, ${row.order_date}, ${row.platform}, ${row.variant_id},
              ${row.quantity}, ${row.selling_price}, ${row.total_amount}, ${accountId}
            )
          `;
        }

        const stockDeductions = validatedRows.reduce((acc: any, row) => {
          acc[row.variant_id] = (acc[row.variant_id] || 0) + row.quantity;
          return acc;
        }, {});

        for (const [vId, qty] of Object.entries(stockDeductions)) {
          await tx`
            UPDATE product_variants 
            SET stock = stock - ${qty as number}
            WHERE id = ${vId} AND account_id = ${accountId}
          `;
        }
      };

      if (typeof sql.begin === 'function') {
        await sql.begin(work);
      } else {
        await work(sql);
      }
    }

    return NextResponse.json({
      totalRows: dataRows.length,
      inserted: validatedRows.length,
      failed: errors.length,
      duplicates: duplicateCount,
      stockErrors: stockErrorCount,
      errors
    });

  } catch (error: any) {
    console.error("FULL ERROR LOG IN BULK UPLOAD:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Detailed server error during upload processing.", 
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}