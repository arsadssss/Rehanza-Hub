import { NextResponse } from 'next/server'
import pool from '@/lib/pg-pool'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'
export const maxDuration = 60


// ------------------------------
// Excel Date Parser
// ------------------------------

function parseExcelDate(value: any) {

  if (!value) return null

  if (value instanceof Date) return value

  // Excel serial number
  if (typeof value === "number") {
    const utc_days = Math.floor(value - 25569)
    const utc_value = utc_days * 86400
    return new Date(utc_value * 1000)
  }

  const parsed = new Date(value)
  if (!isNaN(parsed.getTime())) return parsed

  return null
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


    // --------------------------------
    // Collect SKUs
    // --------------------------------

    const skuSet = new Set<string>()

    rows.forEach(r=>{
      const sku = String(r['SKU'] || '').trim()
      if(sku) skuSet.add(sku)
    })

    const skus = Array.from(skuSet)


    // --------------------------------
    // Fetch existing variants
    // --------------------------------

    const variantMap = new Map<string,string>()

    const existingVariants = await pool.query(
      `
      SELECT id, variant_sku
      FROM product_variants
      WHERE account_id=$1
      AND variant_sku = ANY($2)
      `,
      [accountId, skus]
    )

    existingVariants.rows.forEach(v=>{
      variantMap.set(v.variant_sku, v.id)
    })


    // --------------------------------
    // Create missing SKUs
    // --------------------------------

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


    // --------------------------------
    // Prepare Insert
    // --------------------------------

    const insertValues:string[]=[]
    const params:any[]=[]
    let paramIndex=1


    rows.forEach((row,index)=>{

      try{

        const sku = String(row['SKU'] || '').trim()
        const variant_id = variantMap.get(sku)

        const quantity = parseInt(row['Qty']) || 1

        const external_order_id = String(row['Order Number'] || '').trim()
        const external_suborder_id = String(row['Suborder Number'] || '').trim()

        const return_reason = String(row['Return Reason'] || '').trim()
        const detailed_reason = String(row['Detailed Return Reason'] || '').trim()

        const return_type = String(row['Type of Return'] || '').trim()
const return_sub_type = String(row['Sub Type'] || '').trim()

const courier_partner = String(row['Courier Partner'] || '').trim()
const awb_number = String(row['AWB Number'] || '').trim()

// STATUS should come from Type of Return
const status = String(row['Type of Return'] || '').trim()

        const return_date = parseExcelDate(row['Return Created Date'])
        const dispatch_date = parseExcelDate(row['Dispatch Date'])
        const expected_delivery = parseExcelDate(row['Expected Delivery Date'])

        if(!variant_id || !external_suborder_id){

          summary.failed++

          summary.errors.push({
            row:index+2,
            message:'Missing SKU or Suborder ID'
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

          return_date,
          'Meesho',
          variant_id,
          quantity,

          0, // refund_amount
          0, // shipping_loss
          0, // ads_loss
          0, // damage_loss

          false, // restockable

          accountId,

          external_suborder_id, // external_return_id

          return_reason,
          return_type,

          external_suborder_id,
          external_order_id,

          return_sub_type,
          detailed_reason,

          courier_partner,
          awb_number,

          dispatch_date,
          expected_delivery,

          status

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


    // --------------------------------
    // Insert Returns
    // --------------------------------

    if(insertValues.length>0){

      const insertResult = await pool.query(
        `
        INSERT INTO returns
        (
          return_date,
          platform,
          variant_id,
          quantity,
          refund_amount,
          shipping_loss,
          ads_loss,
          damage_loss,
          restockable,
          account_id,
          external_return_id,
          return_reason,
          return_type,
          external_suborder_id,
          external_order_id,
          return_sub_type,
          detailed_return_reason,
          courier_partner,
          awb_number,
          dispatch_date,
          expected_delivery_date,
          status,
          created_at
        )
        VALUES ${insertValues.join(',')}
        ON CONFLICT (external_suborder_id)
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

    console.error("Meesho Returns Import Error:",error)

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