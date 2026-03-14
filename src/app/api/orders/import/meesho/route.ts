import { NextResponse } from 'next/server'
import pool from '@/lib/pg-pool'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function parseExcelDate(value:any){

  if(!value) return new Date()

  // Excel numeric serial date
  if(typeof value === "number"){
    const excelEpoch = new Date(Date.UTC(1899,11,30))
    return new Date(excelEpoch.getTime() + value * 86400000)
  }

  // String date
  const parsed = new Date(value)

  if(!isNaN(parsed.getTime())){
    return parsed
  }

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
        { success:false,message:"Account context missing" },
        { status:400 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success:false,message:"No file uploaded" },
        { status:400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const workbook = XLSX.read(buffer,{type:'buffer'})
    const sheet = workbook.Sheets[workbook.SheetNames[0]]

    const rows = XLSX.utils.sheet_to_json(sheet) as any[]

    summary.total_rows = rows.length

    if(rows.length === 0){
      return NextResponse.json({ success:false,message:"Empty file"})
    }

    // -------------------------
    // COLLECT SKUs
    // -------------------------

    const skuSet = new Set<string>()

    rows.forEach(r=>{
      const sku = String(r['SKU'] || '').trim().toUpperCase()
      if(sku) skuSet.add(sku)
    })

    const skus = Array.from(skuSet)

    // -------------------------
    // FETCH VARIANTS
    // -------------------------

    const variantMap = new Map<string,string>()

    const existingVariants = await pool.query(
      `SELECT id, variant_sku 
       FROM product_variants 
       WHERE account_id=$1 
       AND variant_sku = ANY($2)`,
      [accountId, skus]
    )

    existingVariants.rows.forEach(v=>{
      variantMap.set(v.variant_sku.toUpperCase(), v.id)
    })

    // -------------------------
    // CREATE MISSING SKUs
    // -------------------------

    const missingSkus = skus.filter(s => !variantMap.has(s))

    if(missingSkus.length>0){

      const insertValues:string[]=[]
      const params:any[]=[]

      missingSkus.forEach((sku,i)=>{
        insertValues.push(`($${i*2+1},0,$${i*2+2},NOW())`)
        params.push(sku,accountId)
      })

      const newVariants = await pool.query(
        `
        INSERT INTO product_variants
        (variant_sku,stock,account_id,created_at)
        VALUES ${insertValues.join(',')}
        RETURNING id,variant_sku
        `,
        params
      )

      newVariants.rows.forEach(v=>{
        variantMap.set(v.variant_sku.toUpperCase(),v.id)
      })

      summary.new_skus = newVariants.rows.length
    }

    // -------------------------
    // PREPARE ORDER INSERT
    // -------------------------

    const insertValues:string[]=[]
    const params:any[]=[]
    let paramIndex=1

    rows.forEach((row,index)=>{

      try{

        const external_id = String(row['Sub Order No'] || '').trim()

        const sku = String(row['SKU'] || '')
        .trim()
        .toUpperCase()

        const quantity = parseInt(row['Quantity']) || 0

        const selling_price = parseFloat(
          row['Supplier Listed Price (Incl. GST + Commission)']
        ) || 0

        const status = String(
          row['Reason for Credit Entry'] || 'UNKNOWN'
        ).trim()

        const orderDate = parseExcelDate(row['Order Date'])

        if(!external_id || !sku){
          summary.failed++
          summary.errors.push({
            row:index+2,
            message:'Missing Order ID or SKU'
          })
          return
        }

        const variant_id = variantMap.get(sku)

        if(!variant_id){
          summary.failed++
          summary.errors.push({
            row:index+2,
            message:'Variant not resolved'
          })
          return
        }

        insertValues.push(
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
          'Meesho',
          variant_id,
          quantity,
          selling_price,
          external_id,
          status,
          accountId
        )

        summary.processed++

      }catch(err:any){

        summary.failed++

        summary.errors.push({
          row:index+2,
          message:err.message
        })

      }

    })

    // -------------------------
    // INSERT ORDERS
    // -------------------------

    if(insertValues.length>0){

      const insertResult = await pool.query(
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
        VALUES ${insertValues.join(',')}
        ON CONFLICT ON CONSTRAINT unique_external_order
        DO NOTHING
        RETURNING id
        `,
        params
      )

      summary.imported = insertResult.rowCount
      summary.duplicates = summary.processed - insertResult.rowCount

    }

    const duration = ((Date.now()-startTime)/1000).toFixed(2)

    return NextResponse.json({
      success:true,
      ...summary,
      duration:`${duration}s`
    })

  }catch(error:any){

    console.error("Meesho Import Fatal Error:",error)

    return NextResponse.json(
      {
        success:false,
        message:"Import failed",
        error:error.message
      },
      { status:500 }
    )

  }

}