/**
 * Database Import Functions for Reconciliation
 * Handles batch inserts and error tracking
 */

import { sql } from '@/lib/db';
import crypto from 'crypto';

/**
 * Calculate hash of file content for duplicate detection
 */
export function calculateFileHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Create reconciliation upload record
 */
export async function createUploadRecord(
  platform: string,
  sourceType: 'order' | 'payment' | 'ads',
  filename: string,
  fileHash: string,
  rowCount: number,
  accountId: string
): Promise<{ id: number; status: string }> {
  const result = await sql`
    INSERT INTO reconciliation_uploads (
      platform, 
      source_type, 
      filename, 
      file_hash, 
      row_count, 
      status, 
      account_id,
      created_at
    )
    VALUES (
      ${platform},
      ${sourceType},
      ${filename},
      ${fileHash},
      ${rowCount},
      'pending',
      ${accountId},
      NOW()
    )
    RETURNING id, status
  `;

  return result[0];
}

/**
 * Check for duplicate upload by file hash
 */
export async function checkDuplicateUpload(
  fileHash: string,
  platform: string,
  sourceType: string
): Promise<boolean> {
  const result = await sql`
    SELECT id FROM reconciliation_uploads 
    WHERE file_hash = ${fileHash} 
      AND platform = ${platform}
      AND source_type = ${sourceType}
      AND status != 'failed'
    LIMIT 1
  `;

  return result.length > 0;
}

/**
 * Insert order raw data
 */
export async function insertOrdersRaw(
  uploadId: number,
  rows: Array<{
    rowNumber: number;
    data: Record<string, any>;
    raw: Record<string, any>;
  }>
): Promise<{ successCount: number; errorIds: number[] }> {
  const errorIds: number[] = [];
  let successCount = 0;

  for (const row of rows) {
    try {
      await sql`
        INSERT INTO reconciliation_orders_raw (
          upload_id,
          row_number,
          sub_order_no,
          catalog_id,
          order_date,
          order_source,
          customer_state,
          product_name,
          sku,
          size,
          quantity,
          supplier_listed_price,
          supplier_discounted_price,
          packet_id,
          raw_data,
          created_at
        )
        VALUES (
          ${uploadId},
          ${row.rowNumber},
          ${row.data.subOrderNo || null},
          ${row.data.catalogId || null},
          ${row.data.orderDate || null},
          ${row.data.orderSource || null},
          ${row.data.customerState || null},
          ${row.data.productName || null},
          ${row.data.sku || null},
          ${row.data.size || null},
          ${row.data.quantity || null},
          ${row.data.supplierListedPrice || null},
          ${row.data.supplierDiscountedPrice || null},
          ${row.data.packetId || null},
          ${JSON.stringify(row.raw)}::jsonb,
          NOW()
        )
      `;
      successCount++;
    } catch (error: any) {
      errorIds.push(row.rowNumber);
    }
  }

  return { successCount, errorIds };
}

/**
 * Insert payment raw data
 */
export async function insertPaymentsRaw(
  uploadId: number,
  rows: Array<{
    rowNumber: number;
    data: Record<string, any>;
    raw: Record<string, any>;
  }>
): Promise<{ successCount: number; errorIds: number[] }> {
  const errorIds: number[] = [];
  let successCount = 0;

  for (const row of rows) {
    try {
      await sql`
        INSERT INTO reconciliation_payments_raw (
          upload_id,
          row_number,
          platform,
          order_no,
          sub_order_no,
          payment_reference,
          payment_type,
          payment_status,
          payment_date,
          amount,
          tcs,
          tds,
          fixed_fee,
          commission,
          warehousing_fee,
          shipping_fee,
          return_shipping_fee,
          raw_data,
          final_settlement_amount,
          total_sale_amount,
          total_sale_return_amount,
          return_premium,
          return_premium_of_return,
          commission_percentage,
          gold_platform_fee,
          mall_platform_fee,
          fixed_fee_gst,
          warehousing_fee_gst,
          return_shipping_charge,
          gst_compensation,
          shipping_charge,
          other_support_service_charges,
          waivers,
          net_other_support_service_charges,
          gst_on_net_other_support_service_charges,
          tds_rate,
          compensation,
          claims_reason,
          compensation_reason,
          recovery_reason,
          created_at
        )
        VALUES (
          ${uploadId},
          ${row.rowNumber},
          'Meesho',
          ${row.data.orderNo || null},
          ${row.data.subOrderNo || null},
          ${row.data.transactionId || null},
          ${row.data.paymentType || null},
          ${row.data.paymentStatus || null},
          ${row.data.paymentDate || null},
          ${row.data.amount || null},
          ${row.data.tcs || null},
          ${row.data.tds || null},
          ${row.data.fixedFee || null},
          ${row.data.commission || null},
          ${row.data.warehousingFee || null},
          ${row.data.shippingFee || null},
          ${row.data.returnShippingFee || null},
          ${JSON.stringify(row.raw)}::jsonb,
          ${row.data.finalSettlementAmount || null},
          ${row.data.totalSaleAmount || null},
          ${row.data.totalSaleReturnAmount || null},
          ${row.data.returnPremium || null},
          ${row.data.returnPremiumOfReturn || null},
          ${row.data.commissionPercentage || null},
          ${row.data.goldPlatformFee || null},
          ${row.data.mallPlatformFee || null},
          ${row.data.fixedFeeGst || null},
          ${row.data.warehousingFeeGst || null},
          ${row.data.returnShippingCharge || null},
          ${row.data.gstCompensation || null},
          ${row.data.shippingCharge || null},
          ${row.data.otherSupportServiceCharges || null},
          ${row.data.waivers || null},
          ${row.data.netOtherSupportServiceCharges || null},
          ${row.data.gstOnNetOtherSupportServiceCharges || null},
          ${row.data.tdsRate || null},
          ${row.data.compensation || null},
          ${row.data.claimsReason || null},
          ${row.data.compensationReason || null},
          ${row.data.recoveryReason || null},
          NOW()
        )
      `;
      successCount++;
    } catch (error: any) {
      errorIds.push(row.rowNumber);
    }
  }

  return { successCount, errorIds };
}

/**
 * Insert ads raw data
 */
export async function insertAdsRaw(
  uploadId: number,
  rows: Array<{
    rowNumber: number;
    data: Record<string, any>;
    raw: Record<string, any>;
  }>
): Promise<{ successCount: number; errorIds: number[] }> {
  const errorIds: number[] = [];
  let successCount = 0;

  for (const row of rows) {
    try {
      await sql`
        INSERT INTO reconciliation_rm_ads_raw (
          upload_id,
          row_number,
          deduction_duration,
          deduction_date,
          campaign_id,
          ad_cost,
          credits_waivers,
          ad_cost_incl_credits,
          gst,
          total_ads_cost,
          raw_data,
          created_at
        )
        VALUES (
          ${uploadId},
          ${row.rowNumber},
          ${row.data.deductionDuration || null},
          ${row.data.deductionDate || null},
          ${row.data.campaignId || null},
          ${row.data.adCost || null},
          ${row.data.creditsWaivers || null},
          ${row.data.adCostInclCredits || null},
          ${row.data.gst || null},
          ${row.data.totalAdsCost || null},
          ${JSON.stringify(row.raw)}::jsonb,
          NOW()
        )
      `;
      successCount++;
    } catch (error: any) {
      errorIds.push(row.rowNumber);
    }
  }

  return { successCount, errorIds };
}

/**
 * Record import errors
 */
export async function recordImportErrors(
  uploadId: number,
  errors: Array<{ rowNumber: number; field?: string; message: string }>
): Promise<void> {
  for (const error of errors) {
    try {
      await sql`
        INSERT INTO reconciliation_import_errors (
          upload_id,
          row_number,
          field_name,
          error_message,
          created_at
        )
        VALUES (
          ${uploadId},
          ${error.rowNumber},
          ${error.field || null},
          ${error.message},
          NOW()
        )
      `;
    } catch (err) {
      console.error('Failed to record import error:', err);
    }
  }
}

/**
 * Update upload status
 */
export async function updateUploadStatus(
  uploadId: number,
  status: 'processing' | 'completed' | 'completed_with_errors' | 'failed',
  successCount: number,
  errorCount: number,
  metadata?: Record<string, any>
): Promise<void> {
  await sql`
    UPDATE reconciliation_uploads
    SET 
      status = ${status},
      successful_rows = ${successCount},
      failed_rows = ${errorCount},
      metadata = ${JSON.stringify(metadata || {})}::jsonb,
      updated_at = NOW()
    WHERE id = ${uploadId}
  `;
}
