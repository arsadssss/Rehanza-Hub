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

    let rows:any[]=[]

    // TSV SUPPORT
    if(file.name.toLowerCase().endsWith(".tsv")){

      const text = buffer.toString()
      const lines = text.split("\n").filter(Boolean)
      const headers = lines[0].split("\t")

      rows = lines.slice(1).map(line=>{
        const values = line.split("\t")
        const obj:any={}
        headers.forEach((h,i)=>{
          obj[h.trim()] = values[i] ? values[i].trim() : ""
        })
        return obj
      })

    }
    else{

      const workbook = XLSX.read(buffer,{type:'buffer'})
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json(sheet)

    }

    summary.total_rows = rows.length

    if(rows.length===0){
      return NextResponse.json({
        success:false,
        message:"Empty file"
      })
    }

    // COLLECT SKUs
    const skuSet = new Set<string>()

    rows.forEach(r=>{
      const sku = String(r['Merchant SKU'] || '').trim()
      if(sku) skuSet.add(sku)
    })

    const skus = Array.from(skuSet)

    // FETCH VARIANTS
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

    // CREATE MISSING SKUs
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

    // PREPARE INSERT
    const insertValues:string[]=[]
    const params:any[]=[]
    let paramIndex=1

    rows.forEach((row,index)=>{

      try{

        const sku = String(row['Merchant SKU'] || '').trim()

        const external_return_id =
          String(row['Amazon RMA ID'] || row['Order Item ID'] || '').trim()

        const external_order_id =
          String(row['Order ID'] || '').trim()

        const quantity = parseInt(row['Return quantity']) || 1

        const return_reason = String(row['Return reason'] || '').trim()

        const return_sub_type = String(row['Return type'] || '').trim()

        const detailed_reason = return_reason

        const awb_number = String(row['Tracking ID'] || '').trim()

        const return_date = parseDate(row['Return request date'])

        const dispatch_date = parseDate(row['Return delivery date'])

        if(!sku){
          summary.failed++
          summary.errors.push({
            row:index+2,
            message:'Missing SKU'
          })
          return
        }

        const variant_id = variantMap.get(sku)

        if(!variant_id){
          summary.failed++
          summary.errors.push({
            row:index+2,
            message:'Variant not found'
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
          return_date,            //1
          'Amazon',               //2
          variant_id,             //3
          quantity,               //4
          0,                      //5 refund_amount
          0,                      //6 shipping_loss
          0,                      //7 ads_loss
          0,                      //8 damage_loss
          false,                  //9 restockable
          accountId,              //10
          external_return_id,     //11
          return_reason,          //12
          'Customer Return',      //13
          external_return_id,     //14 suborder
          external_order_id,      //15
          return_sub_type,        //16
          detailed_reason,        //17
          'Amazon',               //18 courier
          awb_number,             //19
          dispatch_date,          //20
          null,                   //21 expected_delivery
          return_sub_type         //22 status
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

    // INSERT RETURNS
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