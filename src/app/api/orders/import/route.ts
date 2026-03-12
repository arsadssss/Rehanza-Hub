
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const dynamic = "force-dynamic";

/**
 * Helper to find a value in a row object based on a partial key match
 */
function findValueByPattern(row: any, patterns: string[]) {
  const key = Object.keys(row).find(k => 
    patterns.some(p => k.toLowerCase().includes(p.toLowerCase()))
  );
  return key ? row[key] : undefined;
}

/**
 * POST /api/orders/import
 * Handles marketplace report uploads (Amazon .txt/TSV, Flipkart, Meesho)
 * Detects platform, creates missing SKUs, and inserts orders.
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

    const fileName = file.name.toLowerCase();
    const buffer = await file.arrayBuffer();
    
    let jsonData: any[] = [];

    // 1. Parse File
    if (fileName.endsWith('.txt')) {
      const text = new TextDecoder().decode(buffer);
      const workbook = XLSX.read(text, { type: 'string', FS: '\t' });
      const sheetName = workbook.SheetNames[0];
      jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    }

    if (jsonData.length === 0) {
      return NextResponse.json({ success: false, message: "Report is empty or malformed" }, { status: 400 });
    }

    // 2. Detect Platform
    const firstRowKeys = Object.keys(jsonData[0]).map(k => k.toLowerCase());
    let platform = "";

    const isAmazon = firstRowKeys.some(k => k.includes("order-id") || k.includes("quantity-purchased"));
    const isMeesho = firstRowKeys.some(k => k.includes("sub order")) && firstRowKeys.some(k => k.includes("supplier listed price"));
    const isFlipkart = firstRowKeys.some(k => k.includes("order_id") || k.includes("order_item_id") || k.includes("fsn"));

    if (isAmazon) platform = "Amazon";
    else if (isMeesho) platform = "Meesho";
    else if (isFlipkart) platform = "Flipkart";

    if (!platform) {
      return NextResponse.json({ 
        success: false, 
        message: "Unsupported report format. Could not detect platform from headers." 
      }, { status: 400 });
    }

    const stats = {
      orders_imported: 0,
      duplicates_skipped: 0,
      new_skus_created: 0,
      errors: 0
    };

    // 3. Process Rows
    for (const row of jsonData) {
      try {
        let external_id = "";
        let raw_date = "";
        let sku_str = "";
        let qty = 1;
        let price = 0;

        if (platform === "Amazon") {
          external_id = String(row["order-id"] || row["order-item-id"] || "");
          raw_date = row["purchase-date"] || "";
          sku_str = String(row["sku"] || "").trim().toUpperCase();
          qty = parseInt(row["quantity-purchased"]) || 1;
          price = parseFloat(row["item-price"]) || 0;
        } 
        else if (platform === "Meesho") {
          external_id = String(findValueByPattern(row, ["sub order"]) || "");
          raw_date = String(findValueByPattern(row, ["order date"]) || "");
          sku_str = String(row["SKU"] || row["sku"] || findValueByPattern(row, ["sku"]) || "").trim().toUpperCase();
          qty = parseInt(findValueByPattern(row, ["quantity"])) || 1;
          price = parseFloat(findValueByPattern(row, ["supplier listed price"])) || 0;
        } 
        else if (platform === "Flipkart") {
          external_id = String(row["order_id"] || row["order_item_id"] || "");
          raw_date = row["order_date"] || "";
          sku_str = String(row["sku"] || row["fsn"] || "").trim().toUpperCase();
          qty = parseInt(row["quantity"]) || 1;
          price = parseFloat(row["selling_price"] || row["item_price"] || 0);
        }

        if (!external_id || !sku_str) continue;

        // 4. Ensure SKU exists
        let variantRes = await sql`
          SELECT id FROM product_variants 
          WHERE variant_sku = ${sku_str} AND account_id = ${accountId} AND is_deleted = false 
          LIMIT 1
        `;

        if (variantRes.length === 0) {
          let productRes = await sql`
            SELECT id FROM allproducts 
            WHERE sku = ${sku_str} AND account_id = ${accountId} AND is_deleted = false 
            LIMIT 1
          `;

          let productId;
          if (productRes.length === 0) {
            const productName = row["product_name"] || row["title"] || row["Product Name"] || findValueByPattern(row, ["product name"]) || `Auto Imported: ${sku_str}`;
            const newProduct = await sql`
              INSERT INTO allproducts (
                sku, product_name, category, cost_price, margin, promo_ads, tax_other, packing, 
                amazon_ship, flipkart_ship, meesho_price, flipkart_price, amazon_price, stock, account_id
              )
              VALUES (
                ${sku_str}, ${productName}, 'Auto Imported', 0, 0, 20, 10, 15, 80, 80, 0, 0, 0, 0, ${accountId}
              )
              RETURNING id
            `;
            productId = newProduct[0].id;
            stats.new_skus_created++;
          } else {
            productId = productRes[0].id;
          }

          const newVariant = await sql`
            INSERT INTO product_variants (product_id, variant_sku, stock, account_id, low_stock_threshold)
            VALUES (${productId}, ${sku_str}, 0, ${accountId}, 5)
            RETURNING id
          `;
          variantRes = [{ id: newVariant[0].id }];
        }

        const variantId = variantRes[0].id;

        // 5. Insert Order with Duplicate Protection
        const insertRes = await sql`
          INSERT INTO orders (
            external_order_id, order_date, platform, variant_id, quantity, selling_price, account_id, status
          )
          VALUES (
            ${external_id}, ${raw_date}, ${platform}, ${variantId}, ${qty}, ${price}, ${accountId}, 'SHIPPED'
          )
          ON CONFLICT (external_order_id) DO NOTHING
          RETURNING id
        `;

        if (insertRes.length > 0) {
          stats.orders_imported++;
        } else {
          stats.duplicates_skipped++;
        }

      } catch (rowErr) {
        console.error("Error processing row:", rowErr);
        stats.errors++;
      }
    }

    return NextResponse.json({ success: true, ...stats });

  } catch (error: any) {
    console.error("Importer System Error:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Importer failed due to internal error", 
      details: error.message 
    }, { status: 500 });
  }
}
