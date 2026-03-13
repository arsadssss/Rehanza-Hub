import { NextResponse } from 'next/server'
import pool from '@/lib/pg-pool'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function parseExcelDate(value: any) {
  if (!value) return new Date()
  const d = new Date(value)
  if (!isNaN(d.getTime())) return d
  return new Date()
}

export async function POST(request: Request) {
  const startTime = Date.now()

  const summary = {
    total_rows: 0,
    processed: 0,
    imported: 0,
    duplicates: 0,
    failed: 0,
    new_skus: 0,
    errors: [] as any[]
  }

  try {
    const accountId = request.headers.get("x-account-id")

    if (!accountId) {
      return NextResponse.json(
        { success: false, message: "Account context missing" },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file uploaded" },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet) as any[]

    summary.total_rows = rows.length

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: "Empty file" })
    }

    // --------------------------------
    // Collect SKUs
    // --------------------------------
    const skuSet = new Set<string>()
    rows.forEach(r => {
      const sku = String(r['sku'] || '').trim()
      if (sku) skuSet.add(sku)
    })
    const skus = Array.from(skuSet)

    // --------------------------------
    // Fetch Existing Variants
    // --------------------------------
    const variantMap = new Map<string, string>()
    if (skus.length > 0) {
      const variantRes = await pool.query(
        `
        SELECT id, variant_sku
        FROM product_variants
        WHERE account_id = $1
        AND variant_sku = ANY($2)
        `,
        [accountId, skus]
      )
      variantRes.rows.forEach(v => {
        variantMap.set(v.variant_sku, v.id)
      })
    }

    // --------------------------------
    // Fetch Flipkart Prices
    // --------------------------------
    const priceMap = new Map<string, number>()
    if (skus.length > 0) {
      const priceRes = await pool.query(
        `
        SELECT sku, flipkart_price
        FROM allproducts
        WHERE account_id = $1
        AND sku = ANY($2)
        `,
        [accountId, skus]
      )
      priceRes.rows.forEach(p => {
        priceMap.set(p.sku, Number(p.flipkart_price) || 0)
      })
    }

    // --------------------------------
    // Prepare Inserts
    // --------------------------------
    const params: any[] = []
    let paramIndex = 1
    const rowsToInsert: string[] = []

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index]

      try {
        const external_id = String(row['order_id'] || '').trim()
        const sku = String(row['sku'] || '').trim()
        const quantity = parseInt(row['quantity']) || 1
        const rawStatus = String(row['order_item_status'] || 'UNKNOWN').trim().toUpperCase()

        // Apply status mapping
        let status = 'UNKNOWN'
        if (rawStatus.includes('DELIVERED') || rawStatus.includes('SHIPPED')) status = 'SHIPPED'
        else if (rawStatus.includes('READY')) status = 'READY_TO_SHIP'
        else if (rawStatus.includes('CANCEL')) status = 'CANCELLED'
        else status = rawStatus

        if (!external_id || !sku) {
          summary.failed++
          summary.errors.push({
            row: index + 2,
            message: 'Missing Order ID or SKU'
          })
          continue
        }

        let variant_id = variantMap.get(sku)

        // ------------------------------
        // Create Variant if Missing
        // ------------------------------
        if (!variant_id) {
          const createVariant = await pool.query(
            `
            INSERT INTO product_variants
            (variant_sku, stock, account_id, created_at)
            VALUES ($1, 0, $2, NOW())
            RETURNING id
            `,
            [sku, accountId]
          )
          variant_id = createVariant.rows[0].id
          variantMap.set(sku, variant_id)
          summary.new_skus++
        }

        const selling_price = priceMap.get(sku) || 0
        const total_amount = selling_price * quantity

        rowsToInsert.push(
          `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, NOW())`
        )

        params.push(
          parseExcelDate(row['order_date']),
          'Flipkart',
          variant_id,
          quantity,
          selling_price,
          total_amount,
          external_id,
          status,
          accountId
        )

        summary.processed++
      } catch (err: any) {
        summary.failed++
        summary.errors.push({
          row: index + 2,
          message: err.message
        })
      }
    }

    // --------------------------------
    // Insert Orders
    // --------------------------------
    if (rowsToInsert.length > 0) {
      const insertResult = await pool.query(
        `
        INSERT INTO orders
        (
          order_date,
          platform,
          variant_id,
          quantity,
          selling_price,
          total_amount,
          external_order_id,
          status,
          account_id,
          created_at
        )
        VALUES ${rowsToInsert.join(',')}
        ON CONFLICT (external_order_id)
        DO NOTHING
        RETURNING id
        `,
        params
      )

      summary.imported = insertResult.rowCount
      summary.duplicates = summary.processed - insertResult.rowCount
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    return NextResponse.json({
      success: true,
      ...summary,
      duration: `${duration}s`
    })

  } catch (error: any) {
    console.error("Flipkart Import Error:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Import failed",
        error: error.message
      },
      { status: 500 }
    )
  }
}
