/**
 * Meesho Order Extractor
 * Extracts orders directly from the authenticated Meesho Supplier Panel session
 * using the official fulfillment API (`/api/fulfillment/orders`).
 * 
 * Supports cursor-based pagination across fulfillment tabs:
 * - Pending (status: 1)
 * - Ready to Ship (status: 3)
 * - Shipped (status: 4)
 * - Cancelled (status: 5)
 */

import { Page } from 'playwright';

export interface ExtractedMeeshoOrder {
  raw: Record<string, any>;
  tabType: 'pending' | 'ready-to-ship' | 'shipped' | 'cancelled';
  statusCode: number;
}

export interface ExtractOrdersOptions {
  limit?: number;
  maxOrdersPerTab?: number;
  tabs?: Array<'pending' | 'ready-to-ship' | 'shipped' | 'cancelled'>;
  cutoffIso?: string;
}

export interface SupplierDetails {
  id: number;
  identifier: string;
  name: string;
}

const TAB_CONFIGS: Record<
  string,
  { statusCode: number; tabType: 'pending' | 'ready-to-ship' | 'shipped' | 'cancelled' }
> = {
  pending: { statusCode: 1, tabType: 'pending' },
  'ready-to-ship': { statusCode: 3, tabType: 'ready-to-ship' },
  shipped: { statusCode: 4, tabType: 'shipped' },
  cancelled: { statusCode: 5, tabType: 'cancelled' },
};

/**
 * Extracts and flattens subOrders from various Meesho response shapes:
 * - data.subOrders (array or dictionary, used by pending, shipped, cancelled)
 * - data.groups[].orders[].sub_orders[] (grouped structure, used by ready-to-ship)
 * - data.orders[].sub_orders[] (flat orders fallback)
 */
export function parseSubOrdersFromResponse(responseData: any): any[] {
  if (!responseData?.data) return [];

  // 1. Direct subOrders list or dictionary
  if (responseData.data.subOrders) {
    const raw = responseData.data.subOrders;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'object') return Object.values(raw);
  }

  // 2. Groups structure (used by ready-to-ship and other grouped views)
  if (Array.isArray(responseData.data.groups)) {
    const extracted: any[] = [];
    for (const group of responseData.data.groups) {
      if (Array.isArray(group.orders)) {
        for (const order of group.orders) {
          if (Array.isArray(order.sub_orders)) {
            for (const subOrder of order.sub_orders) {
              extracted.push({
                ...subOrder,
                order_num: order.order_num || subOrder.order_num,
                order_id: order.order_num || subOrder.order_id,
                created_iso: order.created_iso || subOrder.created_iso,
                carrier_id: group.carrier_id || subOrder.carrier_id,
                carrier_name: group.carrier_name || subOrder.carrier_name,
                awb: group.awb || subOrder.awb,
                packet_id: group.packet_id || subOrder.packet_id,
                is_manifested: group.is_manifested ?? subOrder.is_manifested,
                label_downloaded: group.label_downloaded ?? subOrder.label_downloaded,
                grouping_key: group.grouping_key,
                raw_group: group,
              });
            }
          }
        }
      }
    }
    return extracted;
  }

  // 3. Flat orders list fallback
  if (Array.isArray(responseData.data.orders)) {
    const extracted: any[] = [];
    for (const order of responseData.data.orders) {
      if (Array.isArray(order.sub_orders)) {
        for (const subOrder of order.sub_orders) {
          extracted.push({
            ...subOrder,
            order_num: order.order_num || subOrder.order_num,
            order_id: order.order_num || subOrder.order_id,
            created_iso: order.created_iso || subOrder.created_iso,
          });
        }
      } else {
        extracted.push(order);
      }
    }
    return extracted;
  }

  return [];
}

export async function extractMeeshoOrders(
  page: Page,
  supplier: SupplierDetails,
  options: ExtractOrdersOptions = {}
): Promise<ExtractedMeeshoOrder[]> {
  const targetTabs = options.tabs && options.tabs.length > 0
    ? options.tabs
    : (['pending', 'ready-to-ship', 'shipped', 'cancelled'] as const);

  const totalLimit = options.limit || 500;
  const maxPerTab = options.maxOrdersPerTab || totalLimit;

  console.log(
    `[Order Extractor] Starting order extraction for supplier ${supplier.identifier} (${supplier.name}, ID: ${supplier.id})...`
  );
  console.log(`[Order Extractor] Tabs: [${targetTabs.join(', ')}], Limit: ${totalLimit}, MaxPerTab: ${maxPerTab}`);

  // Navigate to pending orders page first if not already on fulfillment
  const currentUrl = page.url();
  if (!currentUrl.includes('/fulfillment/')) {
    const ordersUrl = `https://supplier.meesho.com/panel/v3/new/fulfillment/${supplier.identifier}/orders/pending`;
    console.log(`[Order Extractor] Navigating to ${ordersUrl}...`);
    await page.goto(ordersUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
  }

  // Capture actual request headers used by browser
  let capturedHeaders: Record<string, string> = {
    'content-type': 'application/json',
    identifier: supplier.identifier,
    'client-type': 'd-web',
    'client-package-version': '1.0.4',
  };

  const headerListener = (req: any) => {
    if (req.url().includes('/api/fulfillment/orders') && req.method() === 'POST') {
      const h = req.headers();
      if (h['browser-id']) {
        capturedHeaders['browser-id'] = h['browser-id'];
      }
      if (h['client-type']) {
        capturedHeaders['client-type'] = h['client-type'];
      }
      if (h['client-package-version']) {
        capturedHeaders['client-package-version'] = h['client-package-version'];
      }
    }
  };

  page.on('request', headerListener);
  // Wait a short moment to capture headers if page is still initializing
  await page.waitForTimeout(1000);

  const allOrders: ExtractedMeeshoOrder[] = [];

  for (const tabName of targetTabs) {
    if (allOrders.length >= totalLimit) break;

    const config = TAB_CONFIGS[tabName];
    if (!config) continue;

    console.log(`[Order Extractor] --- Querying tab: ${tabName} (status: ${config.statusCode}) ---`);

    let cursor: string | null = null;
    let tabOrderCount = 0;
    let pageNumber = 1;

    while (tabOrderCount < maxPerTab && allOrders.length < totalLimit) {
      const batchLimit = Math.min(50, maxPerTab - tabOrderCount, totalLimit - allOrders.length);
      if (batchLimit <= 0) break;

      const requestPayload: Record<string, any> = {
        enable_hold: true,
        supplier_details: {
          id: supplier.id,
          identifier: supplier.identifier,
          name: supplier.name,
        },
        cursor,
        limit: batchLimit,
        status: config.statusCode,
        type: config.tabType,
        identifier: supplier.identifier,
        child_supplier_identifier: null,
        child_supplier_id: null,
      };

      try {
        const responseData: any = await page.evaluate(
          async ({ url, payload, headers }) => {
            const res = await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify(payload),
            });
            if (!res.ok) {
              const errText = await res.text().catch(() => '');
              return { error: `HTTP ${res.status}: ${errText}` };
            }
            return await res.json();
          },
          {
            url: 'https://supplier.meesho.com/api/fulfillment/orders',
            payload: requestPayload,
            headers: capturedHeaders,
          }
        );

        if (responseData.error) {
          console.warn(`[Order Extractor] [${tabName}] Request error on page ${pageNumber}:`, responseData.error);
          break;
        }

        const subOrdersList = parseSubOrdersFromResponse(responseData);

        console.log(
          `[Order Extractor] [${tabName}] Page ${pageNumber}: fetched ${subOrdersList.length} subOrders (total available in tab: ${responseData.total_count ?? 'unknown'})`
        );

        if (subOrdersList.length === 0) {
          break;
        }

        for (const raw of subOrdersList) {
          allOrders.push({
            raw,
            tabType: config.tabType,
            statusCode: config.statusCode,
          });
          tabOrderCount++;
          if (tabOrderCount >= maxPerTab || allOrders.length >= totalLimit) {
            break;
          }
        }

        if (tabOrderCount >= maxPerTab || allOrders.length >= totalLimit) {
          break;
        }

        // Check next cursor
        cursor = responseData.cursor || null;
        if (!cursor) {
          // No more pages in this tab
          break;
        }

        pageNumber++;
      } catch (err: any) {
        console.error(`[Order Extractor] [${tabName}] Unexpected fetch error:`, err.message);
        break;
      }
    }

    console.log(`[Order Extractor] [${tabName}] Extracted ${tabOrderCount} orders.`);
  }

  page.off('request', headerListener);
  console.log(`[Order Extractor] Completed extraction: total ${allOrders.length} orders extracted.`);
  return allOrders;
}

