/**
 * Database Import Functions for Reconciliation
 * Handles batch inserts, row-level hashing, and error tracking
 */

import { sql } from '@/lib/db';
import crypto from 'crypto';
import { parseDate } from './csv-parser';

export interface ProcessedRow {
  rowNumber: number;
  data: Record<string, any>;
  raw: Record<string, any>;
  rowHash?: string;
}

/**
 * Calculate hash of file content for duplicate detection
 */
export function calculateFileHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Calculate deterministic row hash for row-level deduplication
 */
export function calculateRowHash(
  sourceType: 'order' | 'payment' | 'ads',
  data: Record<string, any>
): string {
  let key = '';
  if (sourceType === 'order') {
    // subOrderNo + sku + quantity + status/reasonForCredit + supplierDiscountedPrice
    const subOrder = String(data.sub_order_no || data.subOrderNo || '').trim();
    const sku = String(data.sku || '').trim().toLowerCase();
    const qty = Number(data.quantity !== undefined && data.quantity !== null ? data.quantity : 1).toFixed(2);
    const status = String(data.reasonForCredit || data.credit_entry_reason || data.status || '').trim().toUpperCase();
    const price = Number(
      data.supplierDiscountedPrice !== undefined && data.supplierDiscountedPrice !== null
        ? data.supplierDiscountedPrice
        : data.supplier_discounted_price !== undefined && data.supplier_discounted_price !== null
        ? data.supplier_discounted_price
        : data.supplierListedPrice || data.supplier_listed_price || 0
    ).toFixed(2);
    key = `order|${subOrder}|${sku}|${qty}|${status}|${price}`;
  } else if (sourceType === 'payment') {
    // subOrderNo + transactionId / payment_reference + paymentDate + finalSettlementAmount
    const subOrder = String(data.sub_order_no || data.subOrderNo || '').trim();
    const txId = String(data.payment_reference || data.transactionId || '').trim();
    const payDate = String(data.payment_date || data.paymentDate || '').split('T')[0].trim();
    const amount = Number(
      data.final_settlement_amount !== undefined && data.final_settlement_amount !== null
        ? data.final_settlement_amount
        : data.amount || 0
    ).toFixed(2);
    key = `payment|${subOrder}|${txId}|${payDate}|${amount}`;
  } else if (sourceType === 'ads') {
    // campaignId + deductionDuration + deductionDate + totalAdsCost/adCost
    const campaignId = String(data.campaign_id || data.campaignId || '').trim();
    const duration = String(data.deduction_duration || data.deductionDuration || '').trim();
    const dedDate = String(data.deduction_date || data.deductionDate || '').split('T')[0].trim();
    const cost = Number(
      data.total_ads_cost !== undefined && data.total_ads_cost !== null
        ? data.total_ads_cost
        : data.totalAdsCost !== undefined && data.totalAdsCost !== null
        ? data.totalAdsCost
        : data.ad_cost !== undefined && data.ad_cost !== null
        ? data.ad_cost
        : data.adCost || 0
    ).toFixed(2);
    key = `ads|${campaignId}|${duration}|${dedDate}|${cost}`;
  }
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Retrieve all existing row hashes (and sub_orders for orders) for an account
 * to allow single-query in-memory duplicate row detection.
 */
export async function getExistingRowHashes(
  accountId: string,
  sourceType: 'order' | 'payment' | 'ads'
): Promise<{ hashes: Set<string>; subOrders: Set<string> }> {
  const hashes = new Set<string>();
  const subOrders = new Set<string>();

  if (!accountId) {
    return { hashes, subOrders };
  }

  if (sourceType === 'order') {
    const rows = await sql`
      SELECT row_hash, sub_order_no 
      FROM reconciliation_orders_raw 
      WHERE account_id = ${accountId}
         OR upload_id IN (SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId});
    `;
    for (const r of rows) {
      if (r.row_hash) hashes.add(r.row_hash);
      if (r.sub_order_no) subOrders.add(String(r.sub_order_no).trim());
    }
  } else if (sourceType === 'payment') {
    const rows = await sql`
      SELECT row_hash 
      FROM reconciliation_payments_raw 
      WHERE account_id = ${accountId}
         OR upload_id IN (SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId});
    `;
    for (const r of rows) {
      if (r.row_hash) hashes.add(r.row_hash);
    }
  } else if (sourceType === 'ads') {
    const rows = await sql`
      SELECT row_hash 
      FROM reconciliation_rm_ads_raw 
      WHERE account_id = ${accountId}
         OR upload_id IN (SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId});
    `;
    for (const r of rows) {
      if (r.row_hash) hashes.add(r.row_hash);
    }
  }

  return { hashes, subOrders };
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
  const uploadTypeMap: Record<string, string> = {
    order: 'orders',
    orders: 'orders',
    payment: 'payments',
    payments: 'payments',
    ads: 'rm_ads',
    rm_ads: 'rm_ads',
  };
  const dbUploadType = uploadTypeMap[sourceType] || 'orders';

  const result = await sql`
    INSERT INTO reconciliation_uploads (
      platform, 
      source_type, 
      upload_type,
      filename, 
      file_name,
      file_hash, 
      row_count, 
      total_rows,
      successful_rows,
      duplicate_rows,
      failed_rows,
      status, 
      processing_status,
      account_id,
      metadata,
      uploaded_at
    )
    VALUES (
      ${platform},
      ${sourceType},
      ${dbUploadType},
      ${filename},
      ${filename},
      ${fileHash},
      ${rowCount},
      ${rowCount},
      0,
      0,
      0,
      'pending',
      'pending',
      ${accountId},
      '{}'::jsonb,
      NOW()
    )
    RETURNING id, status
  `;

  return result[0];
}

/**
 * Check for duplicate upload by file hash (account-scoped)
 */
export async function checkDuplicateUpload(
  fileHash: string,
  platform: string,
  sourceType: string,
  accountId?: string
): Promise<boolean> {
  if (accountId) {
    const result = await sql`
      SELECT id FROM reconciliation_uploads 
      WHERE file_hash = ${fileHash} 
        AND platform = ${platform}
        AND source_type = ${sourceType}
        AND account_id = ${accountId}
        AND status != 'failed'
      LIMIT 1
    `;
    return result.length > 0;
  }

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
 * Insert order raw data using high-speed batch transactions
 */
export async function insertOrdersRaw(
  uploadId: number,
  rows: ProcessedRow[],
  accountId?: string,
  onProgress?: (processed: number, total: number) => void
): Promise<{ successCount: number; errorIds: number[]; errors: Array<{ rowNumber: number; field: string; message: string }> }> {
  const errorIds: number[] = [];
  const errors: Array<{ rowNumber: number; field: string; message: string }> = [];
  let successCount = 0;
  const BATCH_SIZE = 100;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const queries = chunk.map((row) => {
      const rowHash = row.rowHash || calculateRowHash('order', row.data);
      const parsedDate = parseDate(row.data.orderDate);
      const safeOrderDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null;
      const qty = row.data.quantity !== undefined && row.data.quantity !== null && !isNaN(Number(row.data.quantity)) ? Number(row.data.quantity) : 1;
      const listedPrice = row.data.supplierListedPrice !== undefined && row.data.supplierListedPrice !== null && !isNaN(Number(row.data.supplierListedPrice)) ? Number(row.data.supplierListedPrice) : null;
      const discPrice = row.data.supplierDiscountedPrice !== undefined && row.data.supplierDiscountedPrice !== null && !isNaN(Number(row.data.supplierDiscountedPrice)) ? Number(row.data.supplierDiscountedPrice) : null;

      return sql`
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
          credit_entry_reason,
          status,
          raw_data,
          created_at,
          account_id,
          row_hash
        )
        VALUES (
          ${uploadId},
          ${row.rowNumber},
          ${row.data.subOrderNo || null},
          ${row.data.catalogId || null},
          ${safeOrderDate},
          ${row.data.orderSource || null},
          ${row.data.customerState || null},
          ${row.data.productName || null},
          ${row.data.sku || null},
          ${row.data.size || null},
          ${qty},
          ${listedPrice},
          ${discPrice},
          ${row.data.packetId || null},
          ${row.data.reasonForCredit || null},
          ${row.data.reasonForCredit || null},
          ${JSON.stringify(row.raw)}::jsonb,
          NOW(),
          ${accountId || null},
          ${rowHash}
        )
      `;
    });

    try {
      await sql.transaction(queries);
      successCount += chunk.length;
    } catch (batchError) {
      console.warn(`Batch insert warning on orders chunk ${i}-${i + chunk.length}, falling back to per-row:`, batchError);
      for (const row of chunk) {
        try {
          const rowHash = row.rowHash || calculateRowHash('order', row.data);
          const parsedDate = parseDate(row.data.orderDate);
          const safeOrderDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null;
          const qty = row.data.quantity !== undefined && row.data.quantity !== null && !isNaN(Number(row.data.quantity)) ? Number(row.data.quantity) : 1;
          const listedPrice = row.data.supplierListedPrice !== undefined && row.data.supplierListedPrice !== null && !isNaN(Number(row.data.supplierListedPrice)) ? Number(row.data.supplierListedPrice) : null;
          const discPrice = row.data.supplierDiscountedPrice !== undefined && row.data.supplierDiscountedPrice !== null && !isNaN(Number(row.data.supplierDiscountedPrice)) ? Number(row.data.supplierDiscountedPrice) : null;

          await sql`
            INSERT INTO reconciliation_orders_raw (
              upload_id, row_number, sub_order_no, catalog_id, order_date, order_source,
              customer_state, product_name, sku, size, quantity, supplier_listed_price,
              supplier_discounted_price, packet_id, credit_entry_reason, status,
              raw_data, created_at, account_id, row_hash
            )
            VALUES (
              ${uploadId}, ${row.rowNumber}, ${row.data.subOrderNo || null}, ${row.data.catalogId || null},
              ${safeOrderDate}, ${row.data.orderSource || null}, ${row.data.customerState || null},
              ${row.data.productName || null}, ${row.data.sku || null}, ${row.data.size || null},
              ${qty}, ${listedPrice},
              ${discPrice}, ${row.data.packetId || null},
              ${row.data.reasonForCredit || null}, ${row.data.reasonForCredit || null},
              ${JSON.stringify(row.raw)}::jsonb, NOW(), ${accountId || null}, ${rowHash}
            )
          `;
          successCount++;
        } catch (singleErr: any) {
          console.error(`Failed to insert order row ${row.rowNumber}:`, singleErr);
          errorIds.push(row.rowNumber);
          errors.push({
            rowNumber: row.rowNumber,
            field: 'general',
            message: singleErr?.message || 'Database insert failed',
          });
        }
      }
    }

    onProgress?.(successCount, rows.length);
  }

  return { successCount, errorIds, errors };
}

/**
 * Insert payment raw data using high-speed batch transactions
 */
export async function insertPaymentsRaw(
  uploadId: number,
  rows: ProcessedRow[],
  accountId?: string,
  onProgress?: (processed: number, total: number) => void
): Promise<{ successCount: number; errorIds: number[]; errors: Array<{ rowNumber: number; field: string; message: string }> }> {
  const errorIds: number[] = [];
  const errors: Array<{ rowNumber: number; field: string; message: string }> = [];
  let successCount = 0;
  const BATCH_SIZE = 100;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const queries = chunk.map((row) => {
      const rowHash = row.rowHash || calculateRowHash('payment', row.data);
      const parsedPayDate = parseDate(row.data.paymentDate);
      const safePaymentDate = parsedPayDate && !isNaN(parsedPayDate.getTime()) ? parsedPayDate.toISOString() : null;

      return sql`
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
          created_at,
          account_id,
          row_hash
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
          ${safePaymentDate},
          ${row.data.finalSettlementAmount || row.data.amount || null},
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
          NOW(),
          ${accountId || null},
          ${rowHash}
        )
      `;
    });

    try {
      await sql.transaction(queries);
      successCount += chunk.length;
    } catch (batchError) {
      console.warn(`Batch insert warning on payments chunk ${i}-${i + chunk.length}, falling back to per-row:`, batchError);
      for (const row of chunk) {
        try {
          const rowHash = row.rowHash || calculateRowHash('payment', row.data);
          const parsedPayDate = parseDate(row.data.paymentDate);
          const safePaymentDate = parsedPayDate && !isNaN(parsedPayDate.getTime()) ? parsedPayDate.toISOString() : null;

          await sql`
            INSERT INTO reconciliation_payments_raw (
              upload_id, row_number, platform, order_no, sub_order_no, payment_reference,
              payment_type, payment_status, payment_date, amount, tcs, tds, fixed_fee,
              commission, warehousing_fee, shipping_fee, return_shipping_fee, raw_data,
              final_settlement_amount, total_sale_amount, total_sale_return_amount,
              return_premium, return_premium_of_return, commission_percentage,
              gold_platform_fee, mall_platform_fee, fixed_fee_gst, warehousing_fee_gst,
              return_shipping_charge, gst_compensation, shipping_charge,
              other_support_service_charges, waivers, net_other_support_service_charges,
              gst_on_net_other_support_service_charges, tds_rate, compensation,
              claims_reason, compensation_reason, recovery_reason, created_at, account_id, row_hash
            )
            VALUES (
              ${uploadId}, ${row.rowNumber}, 'Meesho', ${row.data.orderNo || null},
              ${row.data.subOrderNo || null}, ${row.data.transactionId || null},
              ${row.data.paymentType || null}, ${row.data.paymentStatus || null},
              ${safePaymentDate}, ${row.data.finalSettlementAmount || row.data.amount || null},
              ${row.data.tcs || null}, ${row.data.tds || null}, ${row.data.fixedFee || null},
              ${row.data.commission || null}, ${row.data.warehousingFee || null},
              ${row.data.shippingFee || null}, ${row.data.returnShippingFee || null},
              ${JSON.stringify(row.raw)}::jsonb, ${row.data.finalSettlementAmount || null},
              ${row.data.totalSaleAmount || null}, ${row.data.totalSaleReturnAmount || null},
              ${row.data.returnPremium || null}, ${row.data.returnPremiumOfReturn || null},
              ${row.data.commissionPercentage || null}, ${row.data.goldPlatformFee || null},
              ${row.data.mallPlatformFee || null}, ${row.data.fixedFeeGst || null},
              ${row.data.warehousingFeeGst || null}, ${row.data.returnShippingCharge || null},
              ${row.data.gstCompensation || null}, ${row.data.shippingCharge || null},
              ${row.data.otherSupportServiceCharges || null}, ${row.data.waivers || null},
              ${row.data.netOtherSupportServiceCharges || null},
              ${row.data.gstOnNetOtherSupportServiceCharges || null}, ${row.data.tdsRate || null},
              ${row.data.compensation || null}, ${row.data.claimsReason || null},
              ${row.data.compensationReason || null}, ${row.data.recoveryReason || null},
              NOW(), ${accountId || null}, ${rowHash}
            )
          `;
          successCount++;
        } catch (singleErr: any) {
          console.error(`Failed to insert payment row ${row.rowNumber}:`, singleErr);
          errorIds.push(row.rowNumber);
          errors.push({
            rowNumber: row.rowNumber,
            field: 'general',
            message: singleErr?.message || 'Database insert failed',
          });
        }
      }
    }

    onProgress?.(successCount, rows.length);
  }

  return { successCount, errorIds, errors };
}

/**
 * Insert ads raw data using high-speed batch transactions
 */
export async function insertAdsRaw(
  uploadId: number,
  rows: ProcessedRow[],
  accountId?: string,
  onProgress?: (processed: number, total: number) => void
): Promise<{ successCount: number; errorIds: number[]; errors: Array<{ rowNumber: number; field: string; message: string }> }> {
  const errorIds: number[] = [];
  const errors: Array<{ rowNumber: number; field: string; message: string }> = [];
  let successCount = 0;
  const BATCH_SIZE = 100;

  const parseSafeDate = (val: any) => {
    if (!val) return null;
    const str = String(val).trim();
    if (!str) return null;
    const firstPart = str.split(/\s+to\s+/i)[0].trim();
    const d = new Date(firstPart);
    return isNaN(d.getTime()) ? null : firstPart;
  };

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const queries = chunk.map((row) => {
      const rowHash = row.rowHash || calculateRowHash('ads', row.data);
      const safeDuration = parseSafeDate(row.data.deductionDuration);
      const safeDate = parseSafeDate(row.data.deductionDate);
      return sql`
        INSERT INTO reconciliation_rm_ads_raw (
          upload_id,
          row_number,
          platform,
          deduction_duration,
          deduction_date,
          campaign_id,
          ad_cost,
          credits_waivers_discounts,
          ad_cost_incl_credits,
          gst,
          total_ads_cost,
          raw_data,
          account_id,
          row_hash,
          created_at
        )
        VALUES (
          ${uploadId},
          ${row.rowNumber},
          'Meesho',
          ${safeDuration},
          ${safeDate},
          ${row.data.campaignId || null},
          ${row.data.adCost || null},
          ${row.data.creditsWaivers || null},
          ${row.data.adCostInclCredits || null},
          ${row.data.gst || null},
          ${row.data.totalAdsCost || null},
          ${JSON.stringify(row.raw)}::jsonb,
          ${accountId || null},
          ${rowHash},
          NOW()
        )
      `;
    });

    try {
      await sql.transaction(queries);
      successCount += chunk.length;
    } catch (batchError) {
      console.warn(`Batch insert warning on ads chunk ${i}-${i + chunk.length}, falling back to per-row:`, batchError);
      for (const row of chunk) {
        try {
          const rowHash = row.rowHash || calculateRowHash('ads', row.data);
          const safeDuration = parseSafeDate(row.data.deductionDuration);
          const safeDate = parseSafeDate(row.data.deductionDate);
          await sql`
            INSERT INTO reconciliation_rm_ads_raw (
              upload_id, row_number, platform, deduction_duration, deduction_date,
              campaign_id, ad_cost, credits_waivers_discounts, ad_cost_incl_credits,
              gst, total_ads_cost, raw_data, account_id, row_hash, created_at
            )
            VALUES (
              ${uploadId}, ${row.rowNumber}, 'Meesho', ${safeDuration},
              ${safeDate}, ${row.data.campaignId || null},
              ${row.data.adCost || null}, ${row.data.creditsWaivers || null},
              ${row.data.adCostInclCredits || null}, ${row.data.gst || null},
              ${row.data.totalAdsCost || null}, ${JSON.stringify(row.raw)}::jsonb,
              ${accountId || null}, ${rowHash}, NOW()
            )
          `;
          successCount++;
        } catch (singleErr: any) {
          console.error(`Failed to insert ads row ${row.rowNumber}:`, singleErr);
          errorIds.push(row.rowNumber);
          errors.push({
            rowNumber: row.rowNumber,
            field: 'general',
            message: singleErr?.message || 'Database insert failed',
          });
        }
      }
    }

    onProgress?.(successCount, rows.length);
  }

  return { successCount, errorIds, errors };
}

/**
 * Record import errors
 */
export async function recordImportErrors(
  uploadId: number,
  errors: Array<{ rowNumber: number; field?: string; message: string }>
): Promise<void> {
  if (!errors || errors.length === 0) return;
  const queries = errors.map((error) => sql`
    INSERT INTO reconciliation_import_errors (
      upload_id,
      row_number,
      error_type,
      error_message,
      created_at
    )
    VALUES (
      ${uploadId},
      ${error.rowNumber || 0},
      ${error.field || 'validation'},
      ${error.message},
      NOW()
    )
  `);
  try {
    await sql.transaction(queries);
  } catch (err) {
    for (const error of errors) {
      try {
        await sql`
          INSERT INTO reconciliation_import_errors (
            upload_id, row_number, error_type, error_message, created_at
          )
          VALUES (
            ${uploadId}, ${error.rowNumber || 0}, ${error.field || 'validation'}, ${error.message}, NOW()
          )
        `;
      } catch (innerErr) {
        console.error('Failed to record import error:', innerErr);
      }
    }
  }
}

/**
 * Update upload status with complete row counts and metadata
 */
export async function updateUploadStatus(
  uploadId: number,
  status: 'processing' | 'completed' | 'completed_with_errors' | 'failed',
  successCount: number,
  errorCount: number,
  duplicateCountOrMetadata?: number | Record<string, any>,
  maybeMetadata?: Record<string, any>
): Promise<void> {
  let duplicateCount = 0;
  let metadata: Record<string, any> = {};

  if (typeof duplicateCountOrMetadata === 'number') {
    duplicateCount = duplicateCountOrMetadata;
    metadata = maybeMetadata || {};
  } else if (typeof duplicateCountOrMetadata === 'object' && duplicateCountOrMetadata !== null) {
    metadata = duplicateCountOrMetadata;
    duplicateCount = Number(metadata.duplicateCount || metadata.duplicate_rows || 0);
  }

  await sql`
    UPDATE reconciliation_uploads
    SET 
      status = ${status},
      processing_status = ${status},
      successful_rows = ${successCount},
      failed_rows = ${errorCount},
      duplicate_rows = ${duplicateCount},
      metadata = ${JSON.stringify(metadata)}::jsonb
    WHERE id = ${uploadId}
  `;
}
