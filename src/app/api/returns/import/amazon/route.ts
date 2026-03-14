import { NextResponse } from 'next/server'
import pool from '@/lib/pg-pool'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'
export const maxDuration = 60


// -----------------------------
// Robust Date Parser
// -----------------------------

function parseDate(value:any){

  if(!value) return null

  if(value instanceof Date) return value

  if(typeof value === "number"){

    const utc_days = Math.floor(value - 25569)
    const utc_value = utc_days * 86400

    return new Date(utc_value * 1000)

  }

  const parsed = new Date(value)

  if(!isNaN(parsed.getTime())) return parsed

  return null
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

    let rows:any[] = []


    // ----------------------------------
    // TSV FILE SUPPORT (Amazon Format)
    // ----------------------------------

    if(file.name.toLowerCase().endsWith(".tsv")){

      const text = buffer.toString()

      const lines = text.split('\n').filter(Boolean)

      const headers = lines[0].split('\t')

      rows = lines.slice(1).map(line=>{

        const values = line.split('\t')

        const obj:any = {}

        headers.forEach((h,i)=>{
          obj[h.trim()] = values[i] ? values[i].trim() : ''
        })

        return obj
      })

    }

    // ----------------------------------
    // EXCEL SUPPORT
    // ----------------------------------

    else{

      const workbook = XLSX.read(buffer,{type:'buffer'})

      const sheet = workbook.Sheets[workbook.SheetNames[0]]

      rows = XLSX.utils.sheet_to_json(sheet)

    }


    summary.total_rows = rows.length

    if(rows.length === 0){
      return NextResponse.json({
        success:false,
        message:"Empty file"
      })
    }



    // ----------------------------------
    // Collect SKUs
    // ----------------------------------

    const skuSet = new Set<string>()

    rows.forEach(r=>{

      const sku = String(r['sku'] || r['SKU'] || '').trim()

      if(sku) skuSet.add(sku)

    })

    const skus = Array.from(skuSet)



    // ----------------------------------
    // Fetch variants
    // ----------------------------------

    const variantMap = new Map<string,string>()

    const existingVariants = await pool.query(

      `
      SELECT id,variant_sku
      FROM product_variants
      WHERE account_id=$1
      AND variant_sku = ANY($2)
      `,
      [accountId,skus]

    )

    existingVariants.rows.forEach(v=>{
      variantMap.set(v.variant_sku,v.id)
    })



    // ----------------------------------
    // Create missing SKUs
    // ----------------------------------

    const missingSkus = skus.filter(s=>!variantMap.has(s))

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
    // Prepare insert
    // ----------------------------------

    const insertValues:string[]=[]
    const params:any[]=[]
    let paramIndex=1



    rows.forEach((row,index)=>{

      try{

        const sku = String(row['sku'] || row['SKU'] || '').trim()

        const variant_id = variantMap.get(sku)

        const quantity = parseInt(row['quantity'] || row['Quantity']) || 1


        const external_return_id = String(
          row['return-id'] || row['Return ID'] || ''
        ).trim()

        const external_order_id = String(
          row['order-id'] || ''
        ).trim()

        const external_suborder_id = external_return_id


        const return_reason = String(
          row['reason'] || ''
        ).trim()

        const detailed_reason = String(
          row['detailed-disposition'] || ''
        ).trim()

        const return_type = "Customer Return"

        const return_sub_type = String(
          row['return-type'] || ''
        ).trim()


        const courier_partner = "Amazon"

        const awb_number = String(
          row['tracking-id'] || ''
        ).trim()


        const status = return_sub_type


        const return_date = parseDate(row['return-request-date'])

        const dispatch_date = parseDate(row['shipment-date'])

        const expected_delivery = null


        if(!variant_id || !external_return_id){

          summary.failed++

          summary.errors.push({
            row:index+2,
            message:"Missing SKU or Return ID"
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
          'Amazon',
          variant_id,
          quantity,

          0,
          0,
          0,
          0,

          false,

          accountId,

          external_return_id,

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

      }
      catch(err:any){

        summary.failed++

        summary.errors.push({
          row:index+2,
          message:err.message
        })

      }

    })



    // ----------------------------------
    // Insert returns
    // ----------------------------------

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
        ON CONFLICT (account_id,external_suborder_id)
        DO NOTHING
        RETURNING id
        `,
        params

      )

      summary.imported = insertResult.rowCount

      summary.duplicates = summary.processed - result.rowCount

    }



    const duration = ((Date.now()-startTime)/1000).toFixed(2)

    return NextResponse.json({
      success:true,
      ...summary,
      duration:`${duration}s`
    })


  }
  catch(error:any){

    console.error("Amazon Return Import Error:",error)

    return NextResponse.json(
      {
        success:false,
        message:"Import failed",
        error:error.message
      },
      {status:500}
    )

  }

}