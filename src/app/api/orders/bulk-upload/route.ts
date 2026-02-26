import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const maxDuration = 60; // Allow 1 minute for large imports

type ImportRow = {
  external_order_id: string;
  order_date: string;
  platform: string;
  variant_sku: string;
  quantity: number;
  selling_price: number;
  rowNumber: number;
};

type ImportError = {
  row: number;
  reason: string;
};

export async function POST(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

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

    const parsedRows: ImportRow[] = [];
    const errors: ImportError[] = [];

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

    const skusToResolve = new Set<string>();
    const externalIdsToCheck = new Set<string>();

    for (let i = 0; i < dataRows.length; i++) {
      const columns = dataRows[i].split(',').map(c => c.trim());
      const rowNum = i + 2;

      const extId = columns[hIdx.external_id];
      const date = columns[hIdx.date];
      const platform = columns[hIdx.platform];
      const sku = columns[hIdx.sku];
      const qty = parseInt(columns[hIdx.qty]);
      const price = parseFloat(columns[hIdx.price]);

      if (!extId || !date || !platform || !sku || isNaN(qty) || isNaN(price)) {
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

    if (parsedRows.length === 0) {
      return NextResponse.json({ 
        totalRows: dataRows.length,
        inserted: 0,
        duplicates: 0,
        stockErrors: 0,
        failed: errors.length,
        errors 
      });
    }

    // Batch Resolve SKUs and Check Duplicates
    const [variantsRes, existingOrdersRes] = await Promise.all([
      sql`SELECT id, variant_sku, stock FROM product_variants WHERE variant_sku = ANY(${Array.from(skusToResolve)}) AND account_id = ${accountId}`,
      sql`SELECT external_order_id FROM orders WHERE external_order_id = ANY(${Array.from(externalIdsToCheck)}) AND account_id = ${accountId} AND is_deleted = false`
    ]);

    const variantMap = new Map(variantsRes.map((v: any) => [v.variant_sku, v]));
    const existingIds = new Set(existingOrdersRes.map((o: any) => o.external_order_id));

    const validatedRows: any[] = [];
    let duplicates = 0;
    let stockErrors = 0;

    // Second pass validation (Business Logic)
    for (const row of parsedRows) {
      if (existingIds.has(row.external_order_id)) {
        errors.push({ row: row.rowNumber, reason: `Duplicate external_order_id: ${row.external_order_id}` });
        duplicates++;
        continue;
      }

      const variant = variantMap.get(row.variant_sku);
      if (!variant) {
        errors.push({ row: row.rowNumber, reason: `SKU not found: ${row.variant_sku}` });
        continue;
      }

      if (variant.stock < row.quantity) {
        errors.push({ row: row.rowNumber, reason: `Insufficient stock for ${row.variant_sku}. Available: ${variant.stock}, Requested: ${row.quantity}` });
        stockErrors++;
        continue;
      }

      validatedRows.push({
        ...row,
        variant_id: variant.id,
        total_amount: row.quantity * row.selling_price
      });
      
      // Optimistically update stock in map for sequential rows in same CSV
      variant.stock -= row.quantity;
    }

    if (validatedRows.length > 0) {
      // Transactional Database Update
      await sql.begin(async (tx: any) => {
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
        // Aggregating quantities by variant_id to minimize queries
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
      });
    }

    return NextResponse.json({
      totalRows: dataRows.length,
      inserted: validatedRows.length,
      duplicates,
      stockErrors,
      failed: errors.length - (duplicates + stockErrors),
      errors
    });

  } catch (error: any) {
    console.error("Bulk Upload Error:", error);
    return NextResponse.json({ success: false, message: "Critical error during import", error: error.message }, { status: 500 });
  }
}
