/**
 * Meesho Payment Extractor
 * Extracts real-time payment data directly from authenticated Meesho Supplier Panel session
 * using official payout endpoints discovered from network inspection:
 * - Upcoming Payments: /api/payouts/payments/upcoming-payments & upcoming-total-amount
 * - Unscheduled Payments: /api/payouts/payments/all-ui-data
 * - Completed Payments: /api/payouts/payments/all-payments & previous-total-amount
 * - Payments Over Time: /api/payouts/payments/panel-graph-overview
 */

import { Page } from 'playwright';
import { SupplierDetails } from './order-extractor';

export interface ExtractedMeeshoPayments {
  upcoming: {
    daywisePayments: Array<{
      date: string;
      headerAmount: string;
      netAmount: number;
      netOrderAmount: number;
      netPlatformRecovery: {
        adsCost: number;
        programCosts: number;
        loanSettlementAmount: number;
        loanSettlementStatus?: string;
      };
      netPlatformCompensation: {
        referralAmount: number;
        programBenefits: number;
      };
      platformCompensation: number;
      platformRecovery: number;
      date_iso: string;
    }>;
    header: {
      headerAmount: string;
      netAmount: number;
      netOrderAmount: number;
      netPlatformRecovery: Record<string, any>;
      netPlatformCompensation: Record<string, any>;
    };
    totalAmount7Days?: {
      headerAmount: string;
      netAmount: number;
    };
    count: number;
  };
  unscheduled: {
    count: number;
    total: number;
    aggregated_data: {
      totalOrderAmt: number;
      adsCost: number;
      referralAmt: number;
      totalNetOrderAmt: number;
    };
    payoutUIList: Array<{
      subOrderNum: string;
      orderNum: string;
      dispatchDate: string;
      liveOrderStatus: string;
      amount: number;
      penalty: number;
      waiver: number;
      recovery: number;
      compensation: number;
      claim: number;
      penaltiesAndRecovery: number;
      waiversAndCompensation: number;
      netAmount: number;
      supplierSKU: string;
      wccBreakUpList?: any[];
      recoveryPenaltyBreakUpList?: any[];
    }>;
  };
  completed: {
    count: number;
    daywisePayments: any[];
    header: {
      headerAmount: string;
      netAmount: number;
      netOrderAmount: number;
      netPlatformRecovery: Record<string, any>;
      netPlatformCompensation: Record<string, any>;
    };
    totalAmount30Days?: {
      headerAmount: string;
      netAmount: number;
    };
  };
  graph: {
    payouts: Array<{
      payment_date: string;
      net_amount: number | null;
      payout_status: string;
      payout_breakup: {
        total_net_order: number | null;
        ads_cost: number | null;
        referral: number | null;
      };
    }>;
  };
  extractedAt: string;
}

export async function extractMeeshoPayments(
  page: Page,
  supplier: SupplierDetails
): Promise<ExtractedMeeshoPayments> {
  console.log(
    `[Payment Extractor] Starting payment extraction for supplier ${supplier.identifier} (${supplier.name}, ID: ${supplier.id})...`
  );

  // Intercept browser payout requests to capture real supplier_id if missing
  page.on('request', (req) => {
    if (req.url().includes('/api/payouts/') && req.method() === 'POST') {
      try {
        const postData = req.postDataJSON ? req.postDataJSON() : JSON.parse(req.postData() || '{}');
        const sid = postData?.supplier_id || postData?.supplierId;
        if (sid && (!supplier.id || supplier.id === 0) && /^\d+$/.test(String(sid))) {
          supplier.id = Number(sid);
          console.log(`[Payment Extractor] Captured dynamic supplier numeric ID: ${supplier.id}`);
        }
      } catch {}
    }
  });

  // 1. Ensure page is on Meesho panel
  const currentUrl = page.url();
  const targetPaymentsUrl = `https://supplier.meesho.com/panel/v3/new/payouts/${supplier.identifier}/payments`;
  if (!currentUrl.includes('/payouts/')) {
    console.log(`[Payment Extractor] Navigating to ${targetPaymentsUrl}...`);
    await page.goto(targetPaymentsUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2500);
  }

  // 2. Prepare request headers
  const reqHeaders: Record<string, string> = {
    'content-type': 'application/json;charset=UTF-8',
    identifier: supplier.identifier,
    'client-type': 'd-web',
    'client-package-version': '1.0.1',
  };

  // 3. Extract Upcoming Payments (daywise + 7 day total)
  console.log('[Payment Extractor] Fetching Upcoming Payments...');
  const upcomingRaw: any = await page.evaluate(
    async ({ headers, supplierId, identifier }) => {
      const [upRes, totalRes] = await Promise.all([
        fetch('https://supplier.meesho.com/api/payouts/payments/upcoming-payments', {
          method: 'POST',
          headers,
          body: JSON.stringify({ identifier, supplier_id: supplierId, limit: 7 }),
        }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('https://supplier.meesho.com/api/payouts/payments/upcoming-total-amount', {
          method: 'POST',
          headers,
          body: JSON.stringify({ identifier, supplier_id: supplierId, limit: 7 }),
        }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      return { upcoming: upRes, total: totalRes };
    },
    { headers: reqHeaders, supplierId: supplier.id, identifier: supplier.identifier }
  );

  // 4. Extract Unscheduled Payments
  console.log('[Payment Extractor] Fetching Unscheduled Payments (all-ui-data)...');
  const unscheduledRaw: any = await page.evaluate(
    async ({ headers, supplierId, identifier }) => {
      let offset = 0;
      const limit = 20; // Meesho API strictly requires limit <= 20
      let allOrders: any[] = [];
      let totalCount = 0;
      let aggregatedData = {
        totalOrderAmt: 0,
        adsCost: 0,
        referralAmt: 0,
        totalNetOrderAmt: 0,
      };

      try {
        const firstRes = await fetch('https://supplier.meesho.com/api/payouts/payments/all-ui-data', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            supplier_id: supplierId,
            supplier_identifier: identifier,
            get_count: true,
            get_aggregated_data: true,
            date: 'unscheduled',
            payment_request: { offset: 0, limit, status: 'pending' },
          }),
        });

        if (firstRes.ok) {
          const json = await firstRes.json();
          totalCount = json.supplier_payout_response?.count || 0;
          aggregatedData = json.aggregated_data || aggregatedData;
          const list = json.supplier_payout_response?.payoutUIList || [];
          allOrders.push(...list);

          // Fetch subsequent batches up to totalCount (up to 100 orders)
          while (allOrders.length < totalCount && allOrders.length < 100) {
            offset += limit;
            const nextRes = await fetch('https://supplier.meesho.com/api/payouts/payments/all-ui-data', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                supplier_id: supplierId,
                supplier_identifier: identifier,
                get_count: false,
                get_aggregated_data: false,
                date: 'unscheduled',
                payment_request: { offset, limit, status: 'pending' },
              }),
            });
            if (nextRes.ok) {
              const nextJson = await nextRes.json();
              const nextList = nextJson.supplier_payout_response?.payoutUIList || [];
              if (nextList.length === 0) break;
              allOrders.push(...nextList);
            } else {
              break;
            }
          }
        }
      } catch (e) {}

      return {
        count: totalCount || allOrders.length,
        aggregated_data: aggregatedData,
        payoutUIList: allOrders,
      };
    },
    { headers: reqHeaders, supplierId: supplier.id, identifier: supplier.identifier }
  );

  // 5. Extract Completed Payments
  console.log('[Payment Extractor] Fetching Completed Payments...');
  const completedRaw: any = await page.evaluate(
    async ({ headers, supplierId, identifier }) => {
      const [compRes, totalRes] = await Promise.all([
        fetch('https://supplier.meesho.com/api/payouts/payments/all-payments', {
          method: 'POST',
          headers,
          body: JSON.stringify({ supplier_id: supplierId, identifier, status: 'paid' }),
        }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('https://supplier.meesho.com/api/payouts/payments/previous-total-amount', {
          method: 'POST',
          headers,
          body: JSON.stringify({ identifier, supplier_id: supplierId, limit: 30 }),
        }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      return { completed: compRes, total: totalRes };
    },
    { headers: reqHeaders, supplierId: supplier.id, identifier: supplier.identifier }
  );

  // 6. Extract Overview Graph
  console.log('[Payment Extractor] Fetching Panel Graph Overview...');
  const graphRaw: any = await page.evaluate(
    async ({ headers, supplierId }) => {
      const res = await fetch('https://supplier.meesho.com/api/payouts/payments/panel-graph-overview', {
        method: 'POST',
        headers,
        body: JSON.stringify({ supplier_id: supplierId, aggregation_level: 'DAILY' }),
      }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      return res;
    },
    { headers: reqHeaders, supplierId: supplier.id }
  );

  const result: ExtractedMeeshoPayments = {
    upcoming: {
      daywisePayments: upcomingRaw.upcoming?.daywisePayments || [],
      header: upcomingRaw.upcoming?.header || {
        headerAmount: '₹0.0',
        netAmount: 0,
        netOrderAmount: 0,
        netPlatformRecovery: {},
        netPlatformCompensation: {},
      },
      totalAmount7Days: upcomingRaw.total || undefined,
      count: upcomingRaw.upcoming?.count || 0,
    },
    unscheduled: {
      count: unscheduledRaw.count || 0,
      total: unscheduledRaw.aggregated_data?.totalNetOrderAmt || 0,
      aggregated_data: unscheduledRaw.aggregated_data || {
        totalOrderAmt: 0,
        adsCost: 0,
        referralAmt: 0,
        totalNetOrderAmt: 0,
      },
      payoutUIList: unscheduledRaw.payoutUIList || [],
    },
    completed: {
      count: completedRaw.completed?.count || 0,
      daywisePayments: completedRaw.completed?.daywisePayments || [],
      header: completedRaw.completed?.header || {
        headerAmount: '₹0.0',
        netAmount: 0,
        netOrderAmount: 0,
        netPlatformRecovery: {},
        netPlatformCompensation: {},
      },
      totalAmount30Days: completedRaw.total || undefined,
    },
    graph: {
      payouts: graphRaw?.payouts || [],
    },
    extractedAt: new Date().toISOString(),
  };

  console.log(
    `[Payment Extractor] Extraction complete! Upcoming: ${result.upcoming.count} days, Unscheduled: ${result.unscheduled.count} orders (₹${result.unscheduled.total}), Completed: ${result.completed.count} payouts.`
  );

  return result;
}

