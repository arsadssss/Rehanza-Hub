
import { NextResponse } from 'next/server';
import pool from '@/lib/pg-pool';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const startTime = Date.now();
  const summary = {
    total_rows: 0,
    processed: 0,
    imported: 0,
    duplicates: 0,
    failed: 0,
    new_skus: 0,
    errors: [] as any[]
  };

  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ success: false, message: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet) as any[];

    summary.total_rows = rows.length;
    const skuCache = new Map<string, string>();
    const BATCH_SIZE = 50;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      
      for (const [index, row] of batch.entries()) {
        const currentRowNum = i + index + 2; // +1 for header, +1 for 0-index
        
        try {
          const external_id = String(row['Sub Order No'] || '').trim();
          const order_date_raw = row['Order Date'];
          const sku = String(row['SKU'] || '').trim();
          const quantity = parseInt(row['Quantity']) || 0;
          const selling_price = parseFloat(row['Supplier Listed Price (Incl. GST + Commission)']) || 0;
          const status = String(row['Reason for Credit Entry'] || 'SHIPPED').trim();

          if (!external_id || !sku) {
            throw new Error(`Missing Order ID or SKU`);
          }

          // 1. Duplicate Check
          const dupCheck = await pool.query('SELECT id FROM orders WHERE external_order_id = $1 AND account_id = $2 LIMIT 1', [external_id, accountId]);
          if (dupCheck.rows.length > 0) {
            summary.duplicates++;
            continue;
          }

          // 2. SKU / Variant Resolution
          let variant_id = skuCache.get(sku);
          if (!variant_id) {
            const variantRes = await pool.query('SELECT id FROM product_variants WHERE variant_sku = $1 AND account_id = $2 LIMIT 1', [sku, accountId]);
            if (variantRes.rows.length > 0) {
              variant_id = variantRes.rows[0].id;
            } else {
              const createRes = await pool.query(
                'INSERT INTO product_variants (variant_sku, stock, account_id, created_at) VALUES ($1, 0, $2, NOW()) RETURNING id',
                [sku, accountId]
              );
              variant_id = createRes.rows[0].id;
              summary.new_skus++;
            }
            skuCache.set(sku, variant_id!);
          }

          // 3. Insert Order
          const total_amount = selling_price * quantity;
          await pool.query(
            `INSERT INTO orders (
              order_date, platform, variant_id, quantity, selling_price, 
              total_amount, external_order_id, status, account_id, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
            [order_date_raw, 'Meesho', variant_id, quantity, selling_price, total_amount, external_id, status, accountId]
          );

          summary.imported++;
        } catch (rowError: any) {
          summary.failed++;
          summary.errors.push({ row: currentRowNum, message: rowError.message });
        }
        summary.processed++;
      }
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`Import completed in ${duration}s for ${summary.total_rows} rows`);

    return NextResponse.json({
      success: true,
      ...summary,
      duration: `${duration}s`
    });

  } catch (error: any) {
    console.error("Meesho Import Fatal Error:", error);
    return NextResponse.json({ success: false, message: "Import failed", error: error.message }, { status: 500 });
  }
}
