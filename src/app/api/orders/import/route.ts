
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export const dynamic = "force-dynamic";

/**
 * Universal Marketplace Order Importer
 * Supports: Meesho, Flipkart, Amazon
 * Formats: .csv, .tsv, .xlsx, .txt
 */

export async function POST(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account context missing" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file || file.size === 0) {
      return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const fileName = file.name.toLowerCase();
    
    let jsonData: any[] = [];

    // 1. Parsing Logic based on file type
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else {
      const text = new TextDecoder().decode(buffer);
      // Auto-detect delimiter: If it contains tabs, use TSV mode
      const isTabDelimited = text.includes('\t');
      const parseResult = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        delimiter: isTabDelimited ? "\t" : ",",
        transformHeader: (h) => h.trim()
      });
      jsonData = parseResult.data;
    }

    if (jsonData.length === 0) {
      return NextResponse.json({ success: false, message: "Report is empty" }, { status: 400 });
    }

    // 2. Platform Detection via Headers
    const headers = Object.keys(jsonData[0]).map(h => h.toLowerCase());
    let platform: 'Meesho' | 'Flipkart' | 'Amazon' | '' = '';

    if (headers.includes('sub order no')) platform = 'Meesho';
    else if (headers.includes('order_item_id')) platform = 'Flipkart';
    else if (headers.includes('order-id')) platform = 'Amazon';

    if (!platform) {
      return NextResponse.json({ 
        success: false, 
        message: "Unsupported report format. Could not detect marketplace.",
        detectedHeaders: Object.keys(jsonData[0])
      }, { status: 400 });
    }

    const stats = {
      imported: 0,
      duplicates: 0,
      new_skus: 0,
      failed: 0,
      errors: [] as { row: number; msg: string }[]
    };

    // 3. Process Rows
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNum = i + 2;

      try {
        let ext_id = "";
        let date_str = "";
        let sku_str = "";
        let qty = 0;
        let price = 0;
        let status = "SHIPPED";

        // Mapping Logic
        if (platform === 'Meesho') {
          ext_id = String(row['Sub Order No'] || "");
          date_str = String(row['Order Date'] || "");
          sku_str = String(row['SKU'] || "").trim().toUpperCase();
          qty = parseInt(row['Quantity']) || 0;
          // Find price column flexibly as it often contains "(Incl. GST...)"
          const priceKey = Object.keys(row).find(k => k.toLowerCase().includes('supplier listed price'));
          price = priceKey ? parseFloat(row[priceKey]) || 0 : 0;
          status = String(row['Reason for Credit Entry'] || "DELIVERED");
        } 
        else if (platform === 'Flipkart') {
          ext_id = String(row['order_item_id'] || "");
          date_str = String(row['order_date'] || "");
          sku_str = String(row['sku'] || "").trim().toUpperCase();
          qty = parseInt(row['quantity']) || 0;
          price = 0; // Flipkart usually requires separate settlement files for pricing
          status = String(row['order_item_status'] || "SHIPPED");
        }
        else if (platform === 'Amazon') {
          ext_id = String(row['order-id'] || "");
          date_str = String(row['purchase-date'] || "");
          sku_str = String(row['sku'] || "").trim().toUpperCase();
          qty = parseInt(row['quantity-purchased']) || 0;
          price = parseFloat(row['item-price']) || 0;
          status = "SHIPPED";
        }

        if (!ext_id || ext_id === "undefined") continue;

        // Duplicate Check
        const existing = await sql`
          SELECT id FROM orders WHERE external_order_id = ${ext_id} AND account_id = ${accountId} LIMIT 1
        `;
        if (existing.length > 0) {
          stats.duplicates++;
          continue;
        }

        // Variant Resolution
        let variantRes = await sql`
          SELECT id FROM product_variants WHERE variant_sku = ${sku_str} AND account_id = ${accountId} AND is_deleted = false LIMIT 1
        `;

        let variantId;
        if (variantRes.length === 0) {
          // Auto-create missing variant
          const newVariant = await sql`
            INSERT INTO product_variants (variant_sku, stock, account_id, low_stock_threshold)
            VALUES (${sku_str}, 0, ${accountId}, 5)
            RETURNING id
          `;
          variantId = newVariant[0].id;
          stats.new_skus++;
        } else {
          variantId = variantRes[0].id;
        }

        const total_amount = price * qty;

        // Atomic Insert and Stock Update
        await sql`
          BEGIN;
          INSERT INTO orders (
            external_order_id, order_date, platform, variant_id, 
            quantity, selling_price, total_amount, account_id, status
          )
          VALUES (
            ${ext_id}, ${date_str}, ${platform}, ${variantId}, 
            ${qty}, ${price}, ${total_amount}, ${accountId}, ${status}
          );
          
          UPDATE product_variants 
          SET stock = stock - ${qty}
          WHERE id = ${variantId} AND account_id = ${accountId};
          COMMIT;
        `;

        stats.imported++;

      } catch (err: any) {
        stats.failed++;
        if (stats.errors.length < 50) {
          stats.errors.push({ row: rowNum, msg: err.message });
        }
      }
    }

    return NextResponse.json({ success: true, ...stats });

  } catch (error: any) {
    console.error("FATAL IMPORT ERROR:", error);
    return NextResponse.json({ 
      success: false, 
      message: "An internal error occurred during import", 
      error: error.message 
    }, { status: 500 });
  }
}
