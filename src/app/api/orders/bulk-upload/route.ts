import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const maxDuration = 60; // Allow 1 minute for large imports

/**
 * POST /api/orders/bulk-upload
 * Processes a CSV file of orders with row-level validation.
 * 
 * Features:
 * - Multi-account isolation
 * - Safe Mode: Skips invalid rows instead of failing the whole batch
 * - Batch duplicate detection
 * - Automated stock deduction
 * - Structured error reporting
 */
export async function POST(request: Request) {
  const accountId = request.headers.get("x-account-id");
  if (!accountId) {
    return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
    
    if (lines.length < 2) {
      return NextResponse.json({ success: false, message: "CSV is empty or missing headers" }, { status: 400 });
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const dataRows = lines.slice(1);

    // Map headers to indices
    const hIdx = {
      external_id: headers.indexOf('external_order_id'),
      date: headers.indexOf('order_date'),
      platform: headers.indexOf('platform'),
      sku: headers.indexOf('variant_sku'),
      qty: headers.indexOf('quantity'),
      price: headers.indexOf('selling_price')
    };

    // Basic Structure Validation
    if (Object.values(hIdx).some(idx => idx === -1)) {
      return NextResponse.json({ 
        success: false, 
        message: "CSV missing required columns. Required: external_order_id, order_date, platform, variant_sku, quantity, selling_price" 
      }, { status: 400 });
    }

    const errors: any[] = [];
    const parsedRows: any[] = [];
    const skusToResolve = new Set<string>();
    const externalIdsToCheck = new Set<string>();

    // Phase 1: Basic validation and data collection (NO THROW)
    for (let i = 0; i < dataRows.length; i++) {
      const columns = dataRows[i].split(',').map(c => c.trim());
      const rowNum = i + 2;

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

      if (qty <= 0 || price <= 0) {
        errors.push({ row: rowNum, reason: "Quantity and price must be positive numbers" });
        continue;
      }

      if (!['Amazon', 'Flipkart', 'Meesho'].includes(platform)) {
        errors.push({ row: rowNum, reason: `Invalid platform: ${platform}. Must be Amazon, Flipkart, or Meesho` });
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

    if (parsedRows.length === 0 && errors.length > 0) {
      return NextResponse.json({ 
        totalRows: dataRows.length,
        inserted: 0,
        failed: errors.length,
        duplicates: 0,
        stockErrors: 0,
        errors 
      });
    }

    // Phase 2: Batch fetch data for validation (NO THROW)
    const [variantsRes, existingOrdersRes] = await Promise.all([
      sql`SELECT id, variant_sku, stock FROM product_variants WHERE variant_sku = ANY(${Array.from(skusToResolve)}) AND account_id = ${accountId}`,
      sql`SELECT external_order_id FROM orders WHERE external_order_id = ANY(${Array.from(externalIdsToCheck)}) AND account_id = ${accountId} AND is_deleted = false`
    ]);

    const variantMap = new Map(variantsRes.map((v: any) => [v.variant_sku, v]));
    const existingIds = new Set(existingOrdersRes.map((o: any) => o.external_order_id));

    const validatedRows: any[] = [];
    let duplicateCount = 0;
    let stockErrorCount = 0;

    // Phase 3: Business logic validation loop (SAFE MODE - NO THROW)
    for (const row of parsedRows) {
      try {
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
        
        // Optimistically update stock in memory map for sequential rows in same CSV
        variant.stock -= row.quantity;
      } catch (rowErr: any) {
        errors.push({ row: row.rowNumber, reason: `Unexpected row error: ${rowErr.message}` });
      }
    }

    console.log("Valid Rows to Insert:", validatedRows.length);
    console.log("Total Errors Found:", errors.length);

    // Phase 4: Database Update Phase
    if (validatedRows.length > 0) {
      try {
        // Atomic work block
        const work = async (tx: any) => {
          // 1. Insert Orders
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

          // 2. Batch Update Stock
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

        // Execute via transaction if supported by driver
        if (typeof sql.begin === 'function') {
          await sql.begin(work);
        } else {
          await work(sql);
        }

      } catch (dbErr: any) {
        console.error("Database Transaction Fatal Error:", dbErr);
        return NextResponse.json({ 
          success: false, 
          message: "Database operation failed", 
          error: dbErr.message,
          totalRows: dataRows.length,
          inserted: 0,
          failed: parsedRows.length,
          errors: [{ row: 0, reason: `Database Fatal Error: ${dbErr.message}` }, ...errors]
        }, { status: 500 });
      }
    }

    // Phase 5: Structured Success Response
    return NextResponse.json({
      totalRows: dataRows.length,
      inserted: validatedRows.length,
      failed: errors.length,
      duplicates: duplicateCount,
      stockErrors: stockErrorCount,
      errors
    });

  } catch (error: any) {
    console.error("Bulk Upload Critical Catch:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Critical error during upload", 
      error: error.message 
    }, { status: 500 });
  }
}
