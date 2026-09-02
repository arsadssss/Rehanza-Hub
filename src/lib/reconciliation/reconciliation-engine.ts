/**
 * Reconciliation Engine
 * Processes raw data and creates transaction records
 * Implements working sheet logic
 */

import { sql } from '@/lib/db';

export interface TransactionRow {
  platform: string;
  order_no: string | null;
  sub_order_no: string;
  sku: string;
  product_name: string;
  status: string;
  quantity: number | null;
  cost: number | null;
  quantity_cost: number | null;
  payment: number | null;
  packaging: number | null;
  shipping_cost: number | null;
  return_shipping_cost: number | null;
  tcs: number | null;
  tds: number | null;
  fixed_fee: number | null;
  platform_commission: number | null;
  warehousing_fee: number | null;
  ad_cost: number | null;
  profit: number | null;
  claim_amount: number | null;
  claim_reason: string | null;
  recovery_amount: number | null;
  recovery_reason: string | null;
  reconciliation_status: string;
  order_source_id: string | null;
  sku_master_id: number | null;
  order_date: string | null;
  dispatch_date: string | null;
  order_source: string | null;
  live_order_status: string | null;
  listing_price: number | null;
  total_sale_amount: number | null;
  total_sale_return_amount: number | null;
  commission_percentage: number | null;
  gold_platform_fee: number | null;
  mall_platform_fee: number | null;
  return_premium: number | null;
  return_premium_of_return: number | null;
  gst_compensation: number | null;
  other_support_service_charges: number | null;
  waivers: number | null;
  net_other_support_service_charges: number | null;
  gst_on_net_other_support_service_charges: number | null;
  compensation: number | null;
  compensation_reason: string | null;
  claims_reason: string | null;
  source_order_id: string | null;
  source_payment_id: number | null;
  source_ads_id: number | null;
}

/**
 * Process reconciliation for an upload
 * Matches orders, payments, and ads data
 */
export async function processReconciliation(uploadId: number): Promise<void> {
  try {
    // Get upload info
    const uploadInfo = await sql`
      SELECT id, source_type, platform FROM reconciliation_uploads WHERE id = ${uploadId}
    `;

    if (!uploadInfo || uploadInfo.length === 0) {
      throw new Error(`Upload ${uploadId} not found`);
    }

    const sourceType = uploadInfo[0].source_type;

    // Process based on source type
    if (sourceType === 'order') {
      await processOrderReconciliation(uploadId);
    } else if (sourceType === 'payment') {
      await processPaymentReconciliation(uploadId);
    } else if (sourceType === 'ads') {
      await processAdsReconciliation(uploadId);
    }

    // Update upload status
    await sql`
      UPDATE reconciliation_uploads
      SET status = 'completed', updated_at = NOW()
      WHERE id = ${uploadId}
    `;
  } catch (error: any) {
    console.error('Reconciliation processing error:', error);
    await sql`
      UPDATE reconciliation_uploads
      SET status = 'failed', updated_at = NOW()
      WHERE id = ${uploadId}
    `;
    throw error;
  }
}

/**
 * Process order reconciliation
 */
async function processOrderReconciliation(uploadId: number): Promise<void> {
  // Get all order raw data from this upload
  const orderRows = await sql`
    SELECT * FROM reconciliation_orders_raw 
    WHERE upload_id = ${uploadId}
    ORDER BY row_number
  `;

  for (const orderRow of orderRows) {
    // Look up SKU master
    const skuMaster = await sql`
      SELECT id, cost_price, packaging_cost FROM reconciliation_sku_master
      WHERE sku = ${orderRow.sku}
      LIMIT 1
    `;

    // Find matching payment
    const payment = await sql`
      SELECT * FROM reconciliation_payments_raw
      WHERE sub_order_no = ${orderRow.sub_order_no}
      LIMIT 1
    `;

    // Calculate quantity cost
    const quantity = orderRow.quantity ? Number(orderRow.quantity) : null;
    const cost = skuMaster?.[0]?.cost_price ? Number(skuMaster[0].cost_price) : null;
    const quantity_cost =
      quantity && cost ? quantity * cost : null;

    // Calculate profit based on status (Delivered, Exchange, Return, etc.)
    const packaging = skuMaster?.[0]?.packaging_cost
      ? Number(skuMaster[0].packaging_cost)
      : null;
    const payment_amount = payment?.[0]?.final_settlement_amount
      ? Number(payment[0].final_settlement_amount)
      : null;

    let profit: number | null = null;
    const status = payment?.[0]?.live_order_status || 'Unknown';

    if (payment_amount !== null) {
      if (
        status === 'Delivered' ||
        status === 'Exchange'
      ) {
        // Profit = Payment - Quantity Cost - Packaging
        profit = payment_amount;
        if (quantity_cost !== null) profit -= quantity_cost;
        if (packaging !== null) profit -= packaging;
      } else if (status === 'Return') {
        // Profit = Payment - Packaging
        profit = payment_amount;
        if (packaging !== null) profit -= packaging;
      }
      // For other statuses, leave profit as null
    }

    // Determine reconciliation status
    let reconciliation_status = 'matched';
    if (!payment) reconciliation_status = 'payment_missing';
    if (!skuMaster || skuMaster.length === 0)
      reconciliation_status = 'sku_missing';

    // Insert transaction record
    try {
      await sql`
        INSERT INTO reconciliation_transactions (
          platform,
          order_no,
          sub_order_no,
          sku,
          product_name,
          status,
          quantity,
          cost,
          quantity_cost,
          payment,
          packaging,
          shipping_cost,
          return_shipping_cost,
          tcs,
          tds,
          fixed_fee,
          platform_commission,
          warehousing_fee,
          ad_cost,
          profit,
          claim_amount,
          claim_reason,
          recovery_amount,
          recovery_reason,
          reconciliation_status,
          order_source_id,
          sku_master_id,
          created_at,
          updated_at,
          order_date,
          dispatch_date,
          order_source,
          live_order_status,
          listing_price,
          total_sale_amount,
          total_sale_return_amount,
          commission_percentage,
          gold_platform_fee,
          mall_platform_fee,
          return_premium,
          return_premium_of_return,
          gst_compensation,
          other_support_service_charges,
          waivers,
          net_other_support_service_charges,
          gst_on_net_other_support_service_charges,
          compensation,
          compensation_reason,
          claims_reason,
          source_order_id,
          source_payment_id
        )
        VALUES (
          'Meesho',
          ${payment?.[0]?.order_no || null},
          ${orderRow.sub_order_no},
          ${orderRow.sku},
          ${orderRow.product_name},
          ${status},
          ${quantity},
          ${cost},
          ${quantity_cost},
          ${payment_amount},
          ${packaging},
          ${payment?.[0]?.shipping_charge || null},
          ${payment?.[0]?.return_shipping_charge || null},
          ${payment?.[0]?.tcs || null},
          ${payment?.[0]?.tds || null},
          ${payment?.[0]?.fixed_fee || null},
          ${payment?.[0]?.commission || null},
          ${payment?.[0]?.warehousing_fee || null},
          null,
          ${profit},
          ${payment?.[0]?.claims ? Number(payment[0].claims) : null},
          ${payment?.[0]?.claims_reason || null},
          ${payment?.[0]?.recovery ? Number(payment[0].recovery) : null},
          ${payment?.[0]?.recovery_reason || null},
          ${reconciliation_status},
          ${orderRow.packet_id || null},
          ${skuMaster?.[0]?.id || null},
          NOW(),
          NOW(),
          ${orderRow.order_date || null},
          null,
          ${orderRow.order_source || null},
          ${status},
          ${payment?.[0]?.listing_price || null},
          ${payment?.[0]?.total_sale_amount || null},
          ${payment?.[0]?.total_sale_return_amount || null},
          ${payment?.[0]?.commission_percentage || null},
          ${payment?.[0]?.gold_platform_fee || null},
          ${payment?.[0]?.mall_platform_fee || null},
          ${payment?.[0]?.return_premium || null},
          ${payment?.[0]?.return_premium_of_return || null},
          ${payment?.[0]?.gst_compensation || null},
          ${payment?.[0]?.other_support_service_charges || null},
          ${payment?.[0]?.waivers || null},
          ${payment?.[0]?.net_other_support_service_charges || null},
          ${payment?.[0]?.gst_on_net_other_support_service_charges || null},
          ${payment?.[0]?.compensation || null},
          ${payment?.[0]?.compensation_reason || null},
          ${payment?.[0]?.claims_reason || null},
          ${orderRow.id},
          ${payment?.[0]?.id || null}
        )
      `;
    } catch (error) {
      console.error(`Failed to insert transaction for order ${orderRow.sub_order_no}:`, error);
    }
  }
}

/**
 * Process payment reconciliation
 * Payments upload should link to existing orders
 */
async function processPaymentReconciliation(uploadId: number): Promise<void> {
  // Get all payment raw data
  const paymentRows = await sql`
    SELECT * FROM reconciliation_payments_raw 
    WHERE upload_id = ${uploadId}
    ORDER BY row_number
  `;

  for (const paymentRow of paymentRows) {
    // Try to find existing transaction
    const existingTx = await sql`
      SELECT id, status, quantity_cost, packaging FROM reconciliation_transactions
      WHERE sub_order_no = ${paymentRow.sub_order_no}
      LIMIT 1
    `;

    if (existingTx && existingTx.length > 0) {
      const tx = existingTx[0];
      const paymentAmount = paymentRow.final_settlement_amount !== null ? Number(paymentRow.final_settlement_amount) : 0;
      let calculatedProfit: number | null = null;
      const effectiveStatus = paymentRow.live_order_status || tx.status;
      if (effectiveStatus === 'Delivered' || effectiveStatus === 'Exchange') {
        calculatedProfit = paymentAmount;
        if (tx.quantity_cost !== null) calculatedProfit -= Number(tx.quantity_cost);
        if (tx.packaging !== null) calculatedProfit -= Number(tx.packaging);
      } else if (effectiveStatus === 'Return') {
        calculatedProfit = paymentAmount;
        if (tx.packaging !== null) calculatedProfit -= Number(tx.packaging);
      }

      // Update existing transaction with payment data and recalculated profit
      await sql`
        UPDATE reconciliation_transactions
        SET 
          payment = ${paymentRow.final_settlement_amount || null},
          profit = ${calculatedProfit},
          shipping_cost = ${paymentRow.shipping_charge || null},
          return_shipping_cost = ${paymentRow.return_shipping_charge || null},
          tcs = ${paymentRow.tcs || null},
          tds = ${paymentRow.tds || null},
          fixed_fee = ${paymentRow.fixed_fee || null},
          platform_commission = ${paymentRow.commission || null},
          warehousing_fee = ${paymentRow.warehousing_fee || null},
          claim_amount = ${paymentRow.claims || null},
          claim_reason = ${paymentRow.claims_reason || null},
          recovery_amount = ${paymentRow.recovery || null},
          recovery_reason = ${paymentRow.recovery_reason || null},
          live_order_status = ${paymentRow.live_order_status || null},
          source_payment_id = ${paymentRow.id},
          updated_at = NOW()
        WHERE id = ${tx.id}
      `;
    }
  }
}

/**
 * Process ads reconciliation
 */
async function processAdsReconciliation(uploadId: number): Promise<void> {
  // Get all ads raw data
  const adsRows = await sql`
    SELECT * FROM reconciliation_rm_ads_raw 
    WHERE upload_id = ${uploadId}
    ORDER BY row_number
  `;

  // Store ads data for Phase 2 processing
  // For now, just mark ads as processed
  // Phase 2 will implement ad cost allocation to transactions
}
