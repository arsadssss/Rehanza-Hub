/**
 * Financial Calculator for Meesho Reconciliation (Phase 2A)
 * 
 * Reusable server-side financial calculation layer that reproduces the exact
 * financial logic of the reference Meesho Reconciliation.xlsx workbook.
 * 
 * Centralizes all SQL aggregations, date filtering, and financial formulas.
 */

import { sql } from '@/lib/db';
import {
  ReconciliationDateFilter,
  DateFilterRange,
  OrderStatusBreakdown,
  FinancialCostMetrics,
  FinancialSummary,
} from './types';

/**
 * Format a numeric value safely to 2 decimal places
 */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Resolve date filter into absolute start and end date bounds
 */
export function resolveDateFilter(filter?: ReconciliationDateFilter): DateFilterRange {
  if (!filter || filter.range === 'all') {
    return { startDate: null, endDate: null, label: 'All Available Data' };
  }

  const now = new Date();

  // Preset ranges
  if (filter.range === '7d') {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return {
      startDate: start.toISOString().split('T')[0] + ' 00:00:00',
      endDate: now.toISOString().split('T')[0] + ' 23:59:59.999',
      label: 'Last 7 Days',
    };
  }

  if (filter.range === '30d') {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return {
      startDate: start.toISOString().split('T')[0] + ' 00:00:00',
      endDate: now.toISOString().split('T')[0] + ' 23:59:59.999',
      label: 'Last 30 Days',
    };
  }

  if (filter.range === '90d') {
    const start = new Date(now);
    start.setDate(start.getDate() - 90);
    return {
      startDate: start.toISOString().split('T')[0] + ' 00:00:00',
      endDate: now.toISOString().split('T')[0] + ' 23:59:59.999',
      label: 'Last 90 Days',
    };
  }

  // Month filter (e.g. '2026-07' or month=7, year=2026)
  if (filter.month) {
    let year = filter.year || now.getFullYear();
    let monthNum: number;

    if (filter.month.includes('-')) {
      const parts = filter.month.split('-');
      year = parseInt(parts[0], 10);
      monthNum = parseInt(parts[1], 10);
    } else {
      monthNum = parseInt(filter.month, 10);
    }

    if (!isNaN(year) && !isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
      const firstDay = new Date(Date.UTC(year, monthNum - 1, 1));
      const lastDay = new Date(Date.UTC(year, monthNum, 0));
      const startStr = firstDay.toISOString().split('T')[0] + ' 00:00:00';
      const endStr = lastDay.toISOString().split('T')[0] + ' 23:59:59.999';
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      return {
        startDate: startStr,
        endDate: endStr,
        label: `${monthNames[monthNum - 1]} ${year}`,
      };
    }
  }

  // Custom date range
  if (filter.startDate && filter.endDate) {
    return {
      startDate: filter.startDate.includes(' ') ? filter.startDate : `${filter.startDate} 00:00:00`,
      endDate: filter.endDate.includes(' ') ? filter.endDate : `${filter.endDate} 23:59:59.999`,
      label: `${filter.startDate} to ${filter.endDate}`,
    };
  }

  return { startDate: null, endDate: null, label: 'All Available Data' };
}

/**
 * Fetch dynamic configuration settings (GST rate, Return filing charge)
 */
async function getReconciliationSettings(): Promise<{ gstRate: number; returnFilingCharge: number }> {
  let gstRate = 0.18; // Default 18%
  let returnFilingCharge = 0.0;

  try {
    const reconSettings = await sql`
      SELECT setting_key, setting_value FROM reconciliation_settings 
      WHERE platform = 'Meesho'
    `;

    for (const s of reconSettings) {
      if (s.setting_key === 'gst_rate' && s.setting_value !== null) {
        const val = Number(s.setting_value);
        // If stored as 18, convert to 0.18
        gstRate = val > 1 ? val / 100 : val;
      }
      if (s.setting_key === 'return_filing_charge' && s.setting_value !== null) {
        returnFilingCharge = Number(s.setting_value);
      }
    }

    // Check app_settings as fallback if gst_rate not in reconciliation_settings
    if (gstRate === 0.18) {
      const appSettings = await sql`
        SELECT setting_value FROM app_settings 
        WHERE setting_key = 'business_config'
      `;
      if (appSettings?.[0]?.setting_value?.gstRate) {
        const rate = Number(appSettings[0].setting_value.gstRate);
        gstRate = rate > 1 ? rate / 100 : rate;
      }
    }
  } catch (error) {
    console.warn('Could not read settings, using defaults (GST: 0.18, Filing: 0):', error);
  }

  return { gstRate, returnFilingCharge };
}

/**
 * Calculate complete Financial Summary for Meesho Reconciliation
 * Strictly scoped to the authenticated account and requested date range.
 */
export async function calculateReconciliationFinancials(
  accountId: string,
  filter?: ReconciliationDateFilter
): Promise<FinancialSummary> {
  if (!accountId) {
    throw new Error('Account context missing for financial calculation');
  }

  const dateRange = resolveDateFilter(filter);
  const { startDate, endDate, label } = dateRange;
  const isDateFiltered = startDate !== null && endDate !== null;

  // 1. Transaction Aggregation
  // Scoped to account via direct account_id OR joined through upload records
  // Date filtering applies to order_date (fallback: created_at)
  const txQuery = isDateFiltered
    ? sql`
        SELECT 
          COALESCE(SUM(quantity), 0)::numeric AS total_orders,
          COALESCE(SUM(quantity) FILTER (WHERE LOWER(status) = 'delivered' OR LOWER(live_order_status) = 'delivered'), 0)::numeric AS delivered_orders,
          COALESCE(SUM(quantity) FILTER (WHERE LOWER(status) = 'shipped' OR LOWER(live_order_status) = 'shipped'), 0)::numeric AS shipped_orders,
          COALESCE(SUM(quantity) FILTER (WHERE LOWER(status) = 'exchange' OR LOWER(live_order_status) = 'exchange'), 0)::numeric AS exchange_orders,
          COALESCE(SUM(quantity) FILTER (WHERE LOWER(status) = 'return' OR LOWER(live_order_status) = 'return'), 0)::numeric AS return_orders,
          COALESCE(SUM(quantity) FILTER (WHERE LOWER(status) = 'rto' OR LOWER(live_order_status) = 'rto'), 0)::numeric AS rto_orders,
          COALESCE(SUM(quantity) FILTER (WHERE LOWER(status) IN ('cancel', 'cancelled') OR LOWER(live_order_status) IN ('cancel', 'cancelled')), 0)::numeric AS cancel_orders,

          -- Awaiting Payment: Delivered orders where payment is 0 or null
          COALESCE(COUNT(*) FILTER (
            WHERE (LOWER(status) = 'delivered' OR LOWER(live_order_status) = 'delivered') 
              AND (payment IS NULL OR payment = 0)
          ), 0)::numeric AS awaiting_payment,

          COALESCE(SUM(payment), 0)::numeric AS settlement_amount,
          COALESCE(SUM(quantity_cost), 0)::numeric AS purchase_cost,
          COALESCE(SUM(packaging), 0)::numeric AS packaging_cost,
          COALESCE(SUM(shipping_cost), 0)::numeric AS shipping_cost,
          COALESCE(SUM(return_shipping_cost), 0)::numeric AS return_shipping_cost,
          COALESCE(SUM(tcs), 0)::numeric AS total_tcs,
          COALESCE(SUM(tds), 0)::numeric AS total_tds,
          COALESCE(SUM(claim_amount), 0)::numeric AS total_claims,
          COALESCE(SUM(recovery_amount), 0)::numeric AS total_recovery,
          COALESCE(SUM(fixed_fee), 0)::numeric AS total_fixed_fee,
          COALESCE(SUM(platform_commission), 0)::numeric AS total_commission,
          COALESCE(SUM(warehousing_fee), 0)::numeric AS total_warehousing_fee,

          -- AOV: Average of Upload Payments column P (Total Sale Amount > 0 and status is valid/nonblank)
          COALESCE(AVG(total_sale_amount) FILTER (
            WHERE total_sale_amount > 0 AND status IS NOT NULL AND status != ''
          ), 0)::numeric AS average_order_value,

          -- Order-level Working Sheet Profit
          COALESCE(SUM(profit), 0)::numeric AS working_sheet_profit_total
        FROM reconciliation_transactions t
        WHERE t.platform = 'Meesho'
          AND (
            t.account_id = ${accountId}
            OR t.source_order_id IN (
              SELECT o.id FROM reconciliation_orders_raw o 
              JOIN reconciliation_uploads u ON o.upload_id = u.id 
              WHERE u.account_id = ${accountId}
            )
            OR t.source_payment_id IN (
              SELECT p.id FROM reconciliation_payments_raw p 
              JOIN reconciliation_uploads u ON p.upload_id = u.id 
              WHERE u.account_id = ${accountId}
            )
          )
          AND (
            (t.order_date IS NOT NULL AND t.order_date >= ${startDate}::timestamp AND t.order_date <= ${endDate}::timestamp)
            OR (
              t.order_date IS NULL AND (
                (t.created_at >= ${startDate}::timestamp AND t.created_at <= ${endDate}::timestamp)
                OR t.source_payment_id IN (
                  SELECT p.id FROM reconciliation_payments_raw p 
                  WHERE p.payment_date >= ${startDate}::date AND p.payment_date <= ${endDate}::date
                )
              )
            )
          )
      `
    : sql`
        SELECT 
          COALESCE(SUM(quantity), 0)::numeric AS total_orders,
          COALESCE(SUM(quantity) FILTER (WHERE LOWER(status) = 'delivered' OR LOWER(live_order_status) = 'delivered'), 0)::numeric AS delivered_orders,
          COALESCE(SUM(quantity) FILTER (WHERE LOWER(status) = 'shipped' OR LOWER(live_order_status) = 'shipped'), 0)::numeric AS shipped_orders,
          COALESCE(SUM(quantity) FILTER (WHERE LOWER(status) = 'exchange' OR LOWER(live_order_status) = 'exchange'), 0)::numeric AS exchange_orders,
          COALESCE(SUM(quantity) FILTER (WHERE LOWER(status) = 'return' OR LOWER(live_order_status) = 'return'), 0)::numeric AS return_orders,
          COALESCE(SUM(quantity) FILTER (WHERE LOWER(status) = 'rto' OR LOWER(live_order_status) = 'rto'), 0)::numeric AS rto_orders,
          COALESCE(SUM(quantity) FILTER (WHERE LOWER(status) IN ('cancel', 'cancelled') OR LOWER(live_order_status) IN ('cancel', 'cancelled')), 0)::numeric AS cancel_orders,

          -- Awaiting Payment: Delivered orders where payment is 0 or null
          COALESCE(COUNT(*) FILTER (
            WHERE (LOWER(status) = 'delivered' OR LOWER(live_order_status) = 'delivered') 
              AND (payment IS NULL OR payment = 0)
          ), 0)::numeric AS awaiting_payment,

          COALESCE(SUM(payment), 0)::numeric AS settlement_amount,
          COALESCE(SUM(quantity_cost), 0)::numeric AS purchase_cost,
          COALESCE(SUM(packaging), 0)::numeric AS packaging_cost,
          COALESCE(SUM(shipping_cost), 0)::numeric AS shipping_cost,
          COALESCE(SUM(return_shipping_cost), 0)::numeric AS return_shipping_cost,
          COALESCE(SUM(tcs), 0)::numeric AS total_tcs,
          COALESCE(SUM(tds), 0)::numeric AS total_tds,
          COALESCE(SUM(claim_amount), 0)::numeric AS total_claims,
          COALESCE(SUM(recovery_amount), 0)::numeric AS total_recovery,
          COALESCE(SUM(fixed_fee), 0)::numeric AS total_fixed_fee,
          COALESCE(SUM(platform_commission), 0)::numeric AS total_commission,
          COALESCE(SUM(warehousing_fee), 0)::numeric AS total_warehousing_fee,

          -- AOV: Average of Upload Payments column P (Total Sale Amount > 0 and status is valid/nonblank)
          COALESCE(AVG(total_sale_amount) FILTER (
            WHERE total_sale_amount > 0 AND status IS NOT NULL AND status != ''
          ), 0)::numeric AS average_order_value,

          -- Order-level Working Sheet Profit
          COALESCE(SUM(profit), 0)::numeric AS working_sheet_profit_total
        FROM reconciliation_transactions t
        WHERE t.platform = 'Meesho'
          AND (
            t.account_id = ${accountId}
            OR t.source_order_id IN (
              SELECT o.id FROM reconciliation_orders_raw o 
              JOIN reconciliation_uploads u ON o.upload_id = u.id 
              WHERE u.account_id = ${accountId}
            )
            OR t.source_payment_id IN (
              SELECT p.id FROM reconciliation_payments_raw p 
              JOIN reconciliation_uploads u ON p.upload_id = u.id 
              WHERE u.account_id = ${accountId}
            )
          )
      `;

  // 2. Total Sales (Invoice) from Upload Orders Raw
  // Column L: Supplier Discounted Price (Incl GST and Commission)
  const salesQuery = isDateFiltered
    ? sql`
        SELECT COALESCE(SUM(supplier_discounted_price), 0)::numeric AS total_sales_invoice
        FROM reconciliation_orders_raw o
        WHERE o.platform = 'Meesho'
          AND (
            o.account_id = ${accountId}
            OR o.upload_id IN (
              SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId}
            )
          )
          AND (
            (o.order_date IS NOT NULL AND o.order_date >= ${startDate}::timestamp AND o.order_date <= ${endDate}::timestamp)
            OR (o.order_date IS NULL AND o.created_at >= ${startDate}::timestamp AND o.created_at <= ${endDate}::timestamp)
          )
      `
    : sql`
        SELECT COALESCE(SUM(supplier_discounted_price), 0)::numeric AS total_sales_invoice
        FROM reconciliation_orders_raw o
        WHERE o.platform = 'Meesho'
          AND (
            o.account_id = ${accountId}
            OR o.upload_id IN (
              SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId}
            )
          )
      `;

  // 3. Total Ads Cost from RM Ads Raw
  // Column H: Total Ads Cost
  const adsQuery = isDateFiltered
    ? sql`
        SELECT COALESCE(SUM(total_ads_cost), 0)::numeric AS total_ads_cost
        FROM reconciliation_rm_ads_raw a
        WHERE a.platform = 'Meesho'
          AND (
            a.account_id = ${accountId}
            OR a.upload_id IN (
              SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId}
            )
          )
          AND (
            (a.deduction_date IS NOT NULL AND a.deduction_date >= ${startDate}::date AND a.deduction_date <= ${endDate}::date)
            OR (a.ad_date IS NOT NULL AND a.ad_date >= ${startDate}::date AND a.ad_date <= ${endDate}::date)
            OR (a.created_at >= ${startDate}::timestamp AND a.created_at <= ${endDate}::timestamp)
          )
      `
    : sql`
        SELECT COALESCE(SUM(total_ads_cost), 0)::numeric AS total_ads_cost
        FROM reconciliation_rm_ads_raw a
        WHERE a.platform = 'Meesho'
          AND (
            a.account_id = ${accountId}
            OR a.upload_id IN (
              SELECT id FROM reconciliation_uploads WHERE account_id = ${accountId}
            )
          )
      `;

  // 4. Sample Claim & Recovery Reasons
  const reasonsQuery = sql`
    SELECT 
      (SELECT claim_reason FROM reconciliation_transactions WHERE claim_reason IS NOT NULL AND claim_reason != '' LIMIT 1) AS claim_reason,
      (SELECT recovery_reason FROM reconciliation_transactions WHERE recovery_reason IS NOT NULL AND recovery_reason != '' LIMIT 1) AS recovery_reason
  `;

  // Execute queries in parallel
  const [txRes, salesRes, adsRes, reasonsRes, settings] = await Promise.all([
    txQuery,
    salesQuery,
    adsQuery,
    reasonsQuery,
    getReconciliationSettings(),
  ]);

  const txData = txRes[0] || {};
  const totalSalesInvoice = round2(Number(salesRes[0]?.total_sales_invoice || 0));
  const rawAdsCost = Number(adsRes[0]?.total_ads_cost || 0);

  // --------------------------------------------------
  // 5. Compute Order Breakdown
  // --------------------------------------------------
  // Total Orders = SUM(quantity) as per workbook Final!D8
  const totalOrders = Math.round(Number(txData.total_orders || 0));
  const deliveredOrders = Math.round(Number(txData.delivered_orders || 0));
  const shippedOrders = Math.round(Number(txData.shipped_orders || 0));
  const exchangeOrders = Math.round(Number(txData.exchange_orders || 0));
  const returnOrders = Math.round(Number(txData.return_orders || 0));
  const rtoOrders = Math.round(Number(txData.rto_orders || 0));
  const cancelOrders = Math.round(Number(txData.cancel_orders || 0));
  const awaitingPayment = Math.round(Number(txData.awaiting_payment || 0));

  // Net Orders: Workbook D20 = SUM(E8+E11+D14+E14+D17)-D17-E14 = Delivered + Exchange + Return
  const netOrders = deliveredOrders + exchangeOrders + returnOrders;

  // Percentage rates (guarding against division by zero)
  const deliveredRate = totalOrders > 0 ? round2((deliveredOrders / totalOrders) * 100) : 0;
  const shippedRate = totalOrders > 0 ? round2((shippedOrders / totalOrders) * 100) : 0;
  const exchangeRate = totalOrders > 0 ? round2((exchangeOrders / totalOrders) * 100) : 0;
  const returnRate = totalOrders > 0 ? round2((returnOrders / totalOrders) * 100) : 0;
  const rtoRate = totalOrders > 0 ? round2((rtoOrders / totalOrders) * 100) : 0;
  const cancelRate = totalOrders > 0 ? round2((cancelOrders / totalOrders) * 100) : 0;

  const orders: OrderStatusBreakdown = {
    totalOrders,
    deliveredOrders,
    deliveredRate,
    shippedOrders,
    shippedRate,
    exchangeOrders,
    exchangeRate,
    returnOrders,
    returnRate,
    rtoOrders,
    rtoRate,
    cancelOrders,
    cancelRate,
    awaitingPayment,
    netOrders,
  };

  // --------------------------------------------------
  // 6. Compute Cost & Expense Metrics
  // --------------------------------------------------
  const settlementAmount = round2(Number(txData.settlement_amount || 0));

  // Purchase Cost: Workbook Final!A11 = -ABS(SUM(Working Sheet G))
  const purchaseCost = -Math.abs(round2(Number(txData.purchase_cost || 0)));

  // Packaging Cost: Workbook Final!B11 = -ABS(SUM(Working Sheet H))
  const packagingCost = -Math.abs(round2(Number(txData.packaging_cost || 0)));

  // Preserve source signs for fees and taxes
  const shippingCost = round2(Number(txData.shipping_cost || 0));
  const returnShippingCost = round2(Number(txData.return_shipping_cost || 0));
  const tcs = round2(Number(txData.total_tcs || 0));
  const tds = round2(Number(txData.total_tds || 0));
  const claims = round2(Number(txData.total_claims || 0));
  const recoveryFees = round2(Number(txData.total_recovery || 0));
  const fixedFee = round2(Number(txData.total_fixed_fee || 0));
  const meeshoCommission = round2(Number(txData.total_commission || 0));
  const warehousingFee = round2(Number(txData.total_warehousing_fee || 0));

  // Ads Cost: Preserve source sign (negative in workbook)
  const adsCost = rawAdsCost > 0 ? -rawAdsCost : round2(rawAdsCost);

  const returnFilingCharge = round2(settings.returnFilingCharge);
  const gstRate = settings.gstRate;
  const gstInputAmount = round2(totalSalesInvoice * gstRate);
  const averageOrderValue = round2(Number(txData.average_order_value || 0));

  const costs: FinancialCostMetrics = {
    purchaseCost,
    packagingCost,
    shippingCost,
    returnShippingCost,
    tcs,
    tds,
    claims,
    claimReason: reasonsRes[0]?.claim_reason || null,
    recoveryFees,
    recoveryReason: reasonsRes[0]?.recovery_reason || null,
    fixedFee,
    meeshoCommission,
    warehousingFee,
    adsCost,
    returnFilingCharge,
  };

  // --------------------------------------------------
  // 7. Payout / Net Profit Calculation
  // --------------------------------------------------
  // Workbook Final!A24:
  // A24 = B8 - B20 - (-A11) - (-B11) - (-G6) - (-H6) - (-H9) - (-G12) - (-H12)
  // Deducting positive expenses from settlement:
  const a24NetCashflow = round2(
    settlementAmount
      - Math.abs(returnFilingCharge)
      - Math.abs(purchaseCost)
      - Math.abs(packagingCost)
      - Math.abs(adsCost)
      - Math.abs(recoveryFees)
      - Math.abs(fixedFee)
      - Math.abs(meeshoCommission)
      - Math.abs(warehousingFee)
  );

  // Workbook Final!A23 / B23:
  // B23 = G9 + (-A17) + (-B17) + A24
  // Claims + TCS credit + TDS credit + A24
  const finalPayoutNetProfit = round2(
    claims
      + Math.abs(tcs)
      + Math.abs(tds)
      + a24NetCashflow
  );

  const orderLevelWorkingSheetProfit = round2(Number(txData.working_sheet_profit_total || 0));

  return {
    period: {
      from: startDate,
      to: endDate,
      label,
    },
    totalSalesInvoice,
    settlementAmount,
    averageOrderValue,
    gstRate,
    gstInputAmount,
    orders,
    costs,
    orderLevelWorkingSheetProfit,
    a24NetCashflow,
    finalPayoutNetProfit,
  };
}

