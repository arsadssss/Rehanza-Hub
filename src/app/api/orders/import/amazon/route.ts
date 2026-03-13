import { NextResponse } from 'next/server'
import pool from '@/lib/pg-pool'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function parseDate(v:any){
  const d = new Date(v)
  return isNaN(d.getTime()) ? new Date() : d
}

export async function POST(request:Request){

  const startTime = Date.now()

  const summary = {
    total_rows:0,
    processed:0,
    imported:0,
    duplicates:0,
    failed:0,
    new_skus:0,
    errors:[] as any[]
  }

  try{

    const accountId = request.headers.get("x-account-id")

    if(!accountId){
      return NextResponse.json(
        {success:false,message:"Account context missing"},
        {status:400}
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if(!file){
      return NextResponse.json(
        {success:false,message:"No file uploaded"},
        {status:400}
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const workbook = XLSX.read(buffer,{type:'buffer'})
    const sheet = workbook.Sheets[workbook.SheetNames[0]]

    const rows = XLSX.utils.sheet_to_json(sheet) as any[]

    summary.total_rows = rows.length

    if(rows.length === 0){
      return NextResponse.json({success:false,message:"Empty file"})
    }

    // -----------------------------
    // Collect SKUs
    // -----------------------------

    const skuSet = new Set<string>()

    rows.forEach(r=>{
      const sku = String(r['sku'] || '').trim().toUpperCase()
      if(sku) skuSet.add(sku)
    })

    const skus = Array.from(skuSet)

    // -----------------------------
    // Fetch Existing Variants
    // -----------------------------

    const variantMap = new Map<string,string>()

    if(skus.length>0){

      const variantRes = await pool.query(
        `
        SELECT id,variant_sku
        FROM product_variants
        WHERE account_id=$1
        AND variant_sku = ANY($2)
        `,
        [accountId,skus]
      )

      variantRes.rows.forEach(v=>{
        variantMap.set(v.variant_sku.toUpperCase(),v.id)
      })
    }

    // -----------------------------
    // Prepare Inserts
    // -----------------------------

    const rowsToInsert:string[]=[]
    const params:any[]=[]
    let paramIndex=1

    for(let i=0;i<rows.length;i++){

      const row = rows[i]

      try{

        const orderId = String(row['order-id']||'').trim()
        const sku = String(row['sku']||'').trim().toUpperCase()

        const quantity = parseInt(row['quantity-purchased']) || 1
        const price = parseFloat(row['item-price']) || 0

        const orderDate = parseDate(row['purchase-date'])

        if(!orderId || !sku){
          summary.failed++
          continue
        }

        let variant_id = variantMap.get(sku)

        // -----------------------------
        // Create Variant if Missing
        // -----------------------------

        if(!variant_id){

          const createRes = await pool.query(
            `
            INSERT INTO product_variants
            (variant_sku,stock,account_id,created_at)
            VALUES ($1,0,$2,NOW())
            RETURNING id
            `,
            [sku,accountId]
          )

          variant_id = createRes.rows[0].id
          variantMap.set(sku,variant_id)

          summary.new_skus++
        }

        rowsToInsert.push(
          `(
          $${paramIndex++},
          $${paramIndex++},
          $${paramIndex++},
          $${paramIndex++},
          $${paramIndex++},
          $${paramIndex++},
          $${paramIndex++},
          $${paramIndex++},
          NOW()
          )`
        )

        params.push(
          orderDate,
          'Amazon',
          variant_id,
          quantity,
          price,
          orderId,
          'SHIPPED',
          accountId
        )

        summary.processed++

      }catch(err:any){

        summary.failed++

        summary.errors.push({
          row:i+2,
          message:err.message
        })

      }

    }

    // -----------------------------
    // Insert Orders
    // -----------------------------

    if(rowsToInsert.length>0){

      const result = await pool.query(
        `
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
        VALUES ${rowsToInsert.join(',')}
        ON CONFLICT (external_order_id)
        DO NOTHING
        RETURNING id
        `,
        params
      )

      summary.imported = result.rowCount
      summary.duplicates = summary.processed - result.rowCount

    }

    const duration = ((Date.now()-startTime)/1000).toFixed(2)

    return NextResponse.json({
      success:true,
      ...summary,
      duration:`${duration}s`
    })

  }catch(error:any){

    return NextResponse.json({
      success:false,
      message:"Import failed",
      error:error.message
    },{status:500})

  }

}