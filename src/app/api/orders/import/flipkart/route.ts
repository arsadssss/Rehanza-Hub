import { NextResponse } from 'next/server';
import pool from '@/lib/pg-pool';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * parseExcelDate - Sanitizes various date formats from Excel
 */
function parseExcelDate(val: any) {
  if (!val) return new Date();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

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
      return NextResponse.json(
        { success: false, message: "Account context missing" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file uploaded" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];

    summary.total_rows = rows.length;

    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "The uploaded file is empty"
      });
    }

    // -----------------------------------------
    // Collect SKUs
    // -----------------------------------------

    const skuSet = new Set<string>();

    rows.forEach(row => {
      const sku = String(row['sku'] || row['SKU'] || '').trim();
      if (sku) skuSet.add(sku);
    });

    const uniqueSkus = Array.from(skuSet);

    // -----------------------------------------
    // Fetch Variants + Prices
    // -----------------------------------------

    const variantMap = new Map<string, string>();
    const priceMap = new Map<string, number>();

    if (uniqueSkus.length > 0) {

      const [variantRes, priceRes] = await Promise.all([

        pool.query(
          `SELECT id, variant_sku
           FROM product_variants
           WHERE account_id = $1
           AND variant_sku = ANY($2)`,
          [accountId, uniqueSkus]
        ),

        pool.query(
          `SELECT sku, flipkart_price
           FROM allproducts
           WHERE account_id = $1
           AND sku = ANY($2)`,
          [accountId, uniqueSkus]
        )

      ]);

      variantRes.rows.forEach(v => {
        variantMap.set(v.variant_sku, v.id);
      });

      priceRes.rows.forEach(p => {
        priceMap.set(p.sku, Number(p.flipkart_price) || 0);
      });
    }

    // -----------------------------------------
    // Process Rows
    // -----------------------------------------

    const ordersToInsert: any[] = [];

    for (let i = 0; i < rows.length; i++) {

      const row = rows[i];

      try {

        const orderId = String(row['order_id'] || row['Order ID'] || '').trim();
        const sku = String(row['sku'] || row['SKU'] || '').trim();

        const quantity = parseInt(row['quantity'] || row['Quantity']) || 1;

        const status = String(
          row['order_item_status'] || row['Status'] || 'UNKNOWN'
        ).trim();

        const orderDate = parseExcelDate(
          row['order_date'] || row['Order Date']
        );

        if (!orderId || !sku) {

          summary.failed++;

          summary.errors.push({
            row: i + 2,
            message: "Missing Order ID or SKU"
          });

          continue;
        }

        // Resolve Variant
        let variant_id = variantMap.get(sku);

        if (!variant_id) {

          const createRes = await pool.query(
            `INSERT INTO product_variants
             (variant_sku, stock, account_id, created_at)
             VALUES ($1,0,$2,NOW())
             RETURNING id`,
            [sku, accountId]
          );

          variant_id = createRes.rows[0].id;

          variantMap.set(sku, variant_id);

          summary.new_skus++;
        }

        const selling_price = priceMap.get(sku) || 0;

        ordersToInsert.push({
          orderDate,
          platform: 'Flipkart',
          variant_id,
          quantity,
          selling_price,
          orderId,
          status,
          accountId
        });

        summary.processed++;

      }
      catch (err: any) {

        summary.failed++;

        summary.errors.push({
          row: i + 2,
          message: err.message
        });
      }
    }

    // -----------------------------------------
    // Batch Insert Orders
    // -----------------------------------------

    if (ordersToInsert.length > 0) {

      const batchSize = 50;

      for (let i = 0; i < ordersToInsert.length; i += batchSize) {

        const batch = ordersToInsert.slice(i, i + batchSize);

        const values: any[] = [];

        const placeholders = batch.map((o, idx) => {

          const offset = idx * 8;

          values.push(
            o.orderDate,
            o.platform,
            o.variant_id,
            o.quantity,
            o.selling_price,
            o.orderId,
            o.status,
            o.accountId
          );

          return `(
            $${offset + 1},
            $${offset + 2},
            $${offset + 3},
            $${offset + 4},
            $${offset + 5},
            $${offset + 6},
            $${offset + 7},
            $${offset + 8},
            NOW()
          )`;
        }).join(',');

        const insertQuery = `
          INSERT INTO orders
          (
            order_date,
            platform,
            variant_id,
            quantity,
            selling_price,
            external_order_id,
            status,
            account_id,
            created_at
          )
          VALUES ${placeholders}
          ON CONFLICT (external_order_id) DO NOTHING
          RETURNING id
        `;

        const result = await pool.query(insertQuery, values);

        summary.imported += result.rowCount || 0;
      }

      summary.duplicates = summary.processed - summary.imported;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    return NextResponse.json({
      success: true,
      ...summary,
      duration: `${duration}s`
    });

  }
  catch (error: any) {

    console.error("FLIPKART_IMPORT_FATAL_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "A fatal error occurred during the import process",
        error: error.message
      },
      { status: 500 }
    );
  }
}