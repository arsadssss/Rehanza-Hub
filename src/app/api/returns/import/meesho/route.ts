import { NextResponse } from 'next/server'
import pool from '@/lib/pg-pool'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function parseDate(v:any){
  if(!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
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

    // ----------------------------------
    // Collect SKUs
    // ----------------------------------

    const skuSet = new Set<string>()

    rows.forEach(r=>{
      const sku = String(r['SKU'] || '').trim()
      if(sku) skuSet.add(sku)
    })

    const skus = Array.from(skuSet)

    // ----------------------------------
    // Fetch Variants
    // ----------------------------------

    const variantMap = new Map<string,string>()

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
      variantMap.set(v.variant_sku,v.id)
    })

    // ----------------------------------
    // Create Missing SKUs
    // ----------------------------------

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
        variantMap.set(v.variant_sku,v.id)
      })

      summary.new_skus = newVariants.rows.length
    }

    // ----------------------------------
    // Prepare Insert
    // ----------------------------------

    const insertValues:string[]=[]
    const params:any[]=[]
    let paramIndex=1

    rows.forEach((row,index)=>{

      try{

        const orderId = String(row['Order Number'] || '').trim()
        const subOrderId = String(row['Suborder Number'] || '').trim()

        const sku = String(row['SKU'] || '').trim()

        const quantity = parseInt(row['Qty']) || 1

        const variant_id = variantMap.get(sku)

        if(!orderId || !subOrderId || !variant_id){

          summary.failed++

          summary.errors.push({
            row:index+2,
            message:'Missing Order ID / SubOrder / SKU'
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

          orderId,
          subOrderId,
          variant_id,
          'Meesho',
          quantity,
          String(row['Type of Return'] || ''),
          String(row['Sub Type'] || ''),
          String(row['Return Reason'] || ''),
          String(row['Detailed Return Reason'] || ''),
          String(row['Status'] || ''),
          String(row['Courier Partner'] || ''),
          String(row['AWB Number'] || ''),
          parseDate(row['Dispatch Date']),
          parseDate(row['Expected Delivery Date']),
          parseDate(row['Return Created Date']),
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

    // ----------------------------------
    // Insert Returns
    // ----------------------------------

    if(insertValues.length>0){

      const result = await pool.query(
        `
        INSERT INTO returns
        (
          external_order_id,
          external_suborder_id,
          variant_id,
          platform,
          quantity,
          return_type,
          return_sub_type,
          return_reason,
          detailed_return_reason,
          status,
          courier_partner,
          awb_number,
          dispatch_date,
          expected_delivery_date,
          return_date,
          account_id,
          created_at
        )
        VALUES ${insertValues.join(',')}
        RETURNING id
        `,
        params
      )

      summary.imported = result.rowCount
    }

    const duration = ((Date.now()-startTime)/1000).toFixed(2)

    return NextResponse.json({
      success:true,
      ...summary,
      duration:`${duration}s`
    })

  }catch(error:any){

    console.error("Return Import Error:",error)

    return NextResponse.json({
      success:false,
      message:"Import failed",
      error:error.message
    },{status:500})

  }

}