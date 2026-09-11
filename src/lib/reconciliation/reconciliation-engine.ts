/**
 * Authoritative Meesho Reconciliation Engine (Excel Parity)
 *
 * Implements the exact logic of the reference Meesho Reconciliation.xlsx workbook:
 * 1. Upload Orders raw data -> Working Sheet order rows (preserves order-side rows without deduplication)
 * 2. Upload Payments raw data -> Payment Pivot aggregation (by Sub Order No)
 * 3. SKU Pivot Table -> SKU Cost Master (Cost & status-dependent Packaging)
 * 4. Working Sheet -> Exact status, cost, packaging, payment, fee, and profit calculations
 * 5. Final -> Dashboard metrics
 */

import { sql } from '@/lib/db';
import { normalizeSku } from './sku-master-service';

export interface PaymentPivotRecord {
  sub_order_no: string;
  payment: number;
  status: string;
  shipping_cost: number;
  return_shipping_cost: number;
  tcs: number;
  tds: number;
  claim_amount: number;
  claim_reason: string | null;
  recovery_amount: number;
  recovery_reason: string | null;
  fixed_fee: number;
  commission: number;
  warehousing_fee: number;
  total_sale_amount: number;
  listing_price: number;
}

/**
 * Generate Payment Pivot Table aggregation from raw payments for an account.
 * Groups by Sub Order No and aggregates exactly like Excel's 'Payment Pivot Table' tab.
 */
export async function generatePaymentPivot(accountId: string): Promise<Map<string, PaymentPivotRecord>> {
  // Find latest completed payments upload for this account
  const latestPayUpload = await sql`
    SELECT id FROM reconciliation_uploads
    WHERE account_id = ${accountId} AND upload_type = 'payments' AND status = 'completed'
    ORDER BY id DESC LIMIT 1
  `;

  if (latestPayUpload.length === 0) {
    return new Map();
  }

  const uploadId = latestPayUpload[0].id;
  const rawPayments = await sql`
    SELECT * FROM reconciliation_payments_raw
    WHERE upload_id = ${uploadId}
    ORDER BY row_number ASC
  `;

  const pivot = new Map<string, PaymentPivotRecord>();

  for (const p of rawPayments) {
    const subOrder = String(p.sub_order_no || '').trim();
    if (!subOrder) continue;

    const raw = (p.raw_data || {}) as Record<string, any>;
    const finalAmt = p.final_settlement_amount !== null ? Number(p.final_settlement_amount) : 0;
    
    // Live Order Status in Excel
    const rawLiveStatus = raw['Live Order Status'] || p.live_order_status;
    const liveStatusStr = rawLiveStatus ? String(rawLiveStatus).trim() : '';

    const shippingCharge = p.shipping_charge !== null ? Number(p.shipping_charge) : 0;
    const returnShippingCharge = p.return_shipping_charge !== null ? Number(p.return_shipping_charge) : 0;
    const tcs = p.tcs !== null ? Number(p.tcs) : 0;
    const tds = p.tds !== null ? Number(p.tds) : 0;
    const claims = raw['Claims']
      ? Number(String(raw['Claims']).replace(/['",₹$]/g, '').trim()) || 0
      : (p.claims ? Number(p.claims) : 0);
    const recovery = raw['Recovery']
      ? Number(String(raw['Recovery']).replace(/['",₹$]/g, '').trim()) || 0
      : (p.recovery ? Number(p.recovery) : 0);
    const fixedFee = p.fixed_fee !== null ? Number(p.fixed_fee) : 0;
    const commission = p.commission !== null ? Number(p.commission) : 0;
    const warehousingFee = p.warehousing_fee !== null ? Number(p.warehousing_fee) : 0;
    const totalSaleAmount = p.total_sale_amount !== null ? Number(p.total_sale_amount) : 0;
    const listingPrice = p.listing_price !== null ? Number(p.listing_price) : 0;

    let existing = pivot.get(subOrder);
    if (!existing) {
      existing = {
        sub_order_no: subOrder,
        payment: 0,
        status: '',
        shipping_cost: 0,
        return_shipping_cost: 0,
        tcs: 0,
        tds: 0,
        claim_amount: 0,
        claim_reason: null,
        recovery_amount: 0,
        recovery_reason: null,
        fixed_fee: 0,
        commission: 0,
        warehousing_fee: 0,
        total_sale_amount: 0,
        listing_price: 0,
      };
      pivot.set(subOrder, existing);
    }

    existing.payment += finalAmt;
    // Excel VLOOKUP returns the first non-empty Live Order Status
    if (!existing.status && liveStatusStr) {
      existing.status = liveStatusStr;
    }
    existing.shipping_cost += shippingCharge;
    existing.return_shipping_cost += returnShippingCharge;
    existing.tcs += tcs;
    existing.tds += tds;
    existing.claim_amount += claims;
    if (!existing.claim_reason && p.claims_reason) {
      existing.claim_reason = String(p.claims_reason).trim();
    }
    existing.recovery_amount += recovery;
    if (!existing.recovery_reason && p.recovery_reason) {
      existing.recovery_reason = String(p.recovery_reason).trim();
    }
    existing.fixed_fee += fixedFee;
    existing.commission += commission;
    existing.warehousing_fee += warehousingFee;
    if (!existing.total_sale_amount && totalSaleAmount > 0) {
      existing.total_sale_amount = totalSaleAmount;
    }
    if (!existing.listing_price && listingPrice > 0) {
      existing.listing_price = listingPrice;
    }
  }

  // If status is still blank after checking all rows, Excel Payment Pivot defaults to "Recovery"
  for (const [, rec] of pivot.entries()) {
    if (!rec.status) {
      rec.status = 'Recovery';
    }
  }

  return pivot;
}

/**
 * Completely rebuilds the Working Sheet reconciliation transactions for an account
 * to exactly mirror the Excel workbook's 'Working Sheet' tab.
 */
export async function rebuildAccountReconciliation(accountId: string): Promise<{ count: number }> {
  // 1. Fetch SKU Master map for this account
  const skuRecords = await sql`
    SELECT id, sku, cost_price, packaging_cost, cost_status
    FROM reconciliation_sku_master
    WHERE account_id = ${accountId}
  `;

  const skuMap = new Map<string, { cost: number; packaging: number; isConfigured: boolean }>();
  for (const r of skuRecords) {
    const norm = normalizeSku(r.sku).toLowerCase();
    const isConfigured = r.cost_status === 'configured';
    skuMap.set(norm, {
      cost: isConfigured && r.cost_price !== null ? Number(r.cost_price) : 0,
      packaging: isConfigured && r.packaging_cost !== null ? Number(r.packaging_cost) : 0,
      isConfigured,
    });
  }

  // 2. Build Payment Pivot Table for this account
  const paymentPivot = await generatePaymentPivot(accountId);

  // 3. Fetch latest completed Orders upload for this account
  const latestOrderUpload = await sql`
    SELECT id FROM reconciliation_uploads
    WHERE account_id = ${accountId} AND upload_type = 'orders' AND status = 'completed'
    ORDER BY id DESC LIMIT 1
  `;

  if (latestOrderUpload.length === 0) {
    return { count: 0 };
  }

  const orderUploadId = latestOrderUpload[0].id;
  const rawOrders = await sql`
    SELECT * FROM reconciliation_orders_raw
    WHERE upload_id = ${orderUploadId}
    ORDER BY row_number ASC
  `;

  // 4. Clean existing transactions for this account to guarantee 1-to-1 parity with Working Sheet
  await sql`DELETE FROM reconciliation_transactions WHERE account_id = ${accountId};`;

  if (rawOrders.length === 0) {
    return { count: 0 };
  }

  // 5. Transform each order row into exact Working Sheet representation
  const batchSize = 50;
  let inserted = 0;

  for (let i = 0; i < rawOrders.length; i += batchSize) {
    const chunk = rawOrders.slice(i, i + batchSize);

    await Promise.all(
      chunk.map(async (order: any) => {
        const subOrder = String(order.sub_order_no || '').trim();
        const sku = String(order.sku || '').trim();
        const normSku = normalizeSku(sku).toLowerCase();
        const qty = order.quantity ? Number(order.quantity) : 1;
        const skuConfig = skuMap.get(normSku) || { cost: 0, packaging: 0, isConfigured: false };

        const pivot = paymentPivot.get(subOrder);
        // Working Sheet Status formula:
        // =IF(ISBLANK(A2), "", IFERROR(VLOOKUP(A2, 'Payment Pivot Table'!A:C, 3, FALSE), "Cancel"))
        const status = pivot ? pivot.status : 'Cancel';

        // Working Sheet Cost formula:
        // =IF(B2="","",IF((E2="RTO")+(E2="Return")+(E2="Cancel")+(E2="Recovery"), "", VLOOKUP(B2, SKU_Pivot, 2, 0)))
        let unitCost: number | null = null;
        let quantityCost: number | null = null;
        if (
          status !== 'RTO' &&
          status !== 'Return' &&
          status !== 'Cancel' &&
          status !== 'Cancelled' &&
          status !== 'Recovery'
        ) {
          unitCost = skuConfig.cost;
          quantityCost = unitCost * qty;
        }

        // Working Sheet Packaging formula:
        // =IF(B2="","",IF((E2="Cancel")+(E2="Recovery"),"",basePkg*IF(E2="Exchange",2,1)+IF(F2>1,(F2-1)*5,0)-IF(E2="RTO",5,0)))
        let packaging: number | null = null;
        if (status !== 'Cancel' && status !== 'Cancelled' && status !== 'Recovery') {
          const basePkg = skuConfig.packaging;
          const mult = status === 'Exchange' ? 2 : 1;
          const extraQty = qty > 1 ? (qty - 1) * 5 : 0;
          const rtoSub = status === 'RTO' ? 5 : 0;
          packaging = basePkg * mult + extraQty - rtoSub;
        }

        // Working Sheet Payment: lookup from Payment Pivot
        const payment = pivot ? pivot.payment : null;

        // Working Sheet Profit formula:
        // =IF(OR(TRIM(E2)="Delivered", TRIM(E2)="Exchange"), D2-G2-H2, IF(TRIM(E2)="Return", D2-H2, ""))
        let profit: number | null = null;
        if (payment !== null) {
          if (status === 'Delivered' || status === 'Exchange') {
            profit = payment - (quantityCost || 0) - (packaging || 0);
          } else if (status === 'Return') {
            profit = payment - (packaging || 0);
          }
        }

        const shippingCost = pivot && pivot.shipping_cost !== 0 ? pivot.shipping_cost : null;
        const returnShippingCost = pivot && pivot.return_shipping_cost !== 0 ? pivot.return_shipping_cost : null;
        const tcs = pivot && pivot.tcs !== 0 ? pivot.tcs : null;
        const tds = pivot && pivot.tds !== 0 ? pivot.tds : null;
        const claims = pivot && pivot.claim_amount !== 0 ? pivot.claim_amount : null;
        const recovery = pivot && pivot.recovery_amount !== 0 ? pivot.recovery_amount : null;
        const fixedFee = pivot && pivot.fixed_fee !== 0 ? pivot.fixed_fee : null;
        const commission = pivot && pivot.commission !== 0 ? pivot.commission : null;
        const warehousing = pivot && pivot.warehousing_fee !== 0 ? pivot.warehousing_fee : null;
        const totalSaleAmount = pivot && pivot.total_sale_amount > 0 ? pivot.total_sale_amount : null;

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
            profit,
            claim_amount,
            claim_reason,
            recovery_amount,
            recovery_reason,
            reconciliation_status,
            order_source_id,
            source_order_id,
            created_at,
            updated_at,
            order_date,
            order_source,
            live_order_status,
            listing_price,
            total_sale_amount,
            account_id
          )
          VALUES (
            'Meesho',
            ${order.order_no || null},
            ${subOrder},
            ${sku},
            ${order.product_name || sku},
            ${status},
            ${qty},
            ${unitCost},
            ${quantityCost},
            ${payment},
            ${packaging},
            ${shippingCost},
            ${returnShippingCost},
            ${tcs},
            ${tds},
            ${fixedFee},
            ${commission},
            ${warehousing},
            ${profit},
            ${claims},
            ${pivot?.claim_reason || null},
            ${recovery},
            ${pivot?.recovery_reason || null},
            'matched',
            ${order.id},
            ${order.id},
            NOW(),
            NOW(),
            ${order.order_date || null},
            ${order.order_source || null},
            ${pivot?.status || null},
            ${pivot?.listing_price || null},
            ${totalSaleAmount},
            ${accountId}
          );
        `;
        inserted++;
      })
    );
  }

  return { count: inserted };
}

/**
 * Process reconciliation for an upload.
 * Any upload (order, payment, or ads) triggers an idempotent account reconciliation rebuild.
 */
export async function processReconciliation(uploadId: number): Promise<void> {
  try {
    const uploadInfo = await sql`
      SELECT id, source_type, upload_type, platform, account_id 
      FROM reconciliation_uploads 
      WHERE id = ${uploadId}
    `;

    if (!uploadInfo || uploadInfo.length === 0) {
      throw new Error(`Upload ${uploadId} not found`);
    }

    const accountId = uploadInfo[0].account_id;

    // Update upload status to completed
    await sql`
      UPDATE reconciliation_uploads
      SET status = 'completed'
      WHERE id = ${uploadId}
    `;

    // Rebuild authoritative Working Sheet transactions for this account
    if (accountId) {
      await rebuildAccountReconciliation(accountId);
    }
  } catch (error: any) {
    console.error('Reconciliation processing error:', error);
    await sql`
      UPDATE reconciliation_uploads
      SET status = 'failed'
      WHERE id = ${uploadId}
    `;
    throw error;
  }
}

/**
 * Resync all existing transactions for an account using authoritative Excel logic.
 */
export async function resyncAllTransactions(accountId?: string): Promise<{ updated: number }> {
  if (!accountId) {
    // Get all accounts
    const accounts = await sql`SELECT DISTINCT account_id FROM reconciliation_uploads WHERE account_id IS NOT NULL`;
    let total = 0;
    for (const acc of accounts) {
      const res = await rebuildAccountReconciliation(acc.account_id);
      total += res.count;
    }
    return { updated: total };
  }

  const res = await rebuildAccountReconciliation(accountId);
  return { updated: res.count };
}

