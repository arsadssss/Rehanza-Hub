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

export async function extractMeeshoOrders(
  page: Page,
  supplier: SupplierDetails,
  options: ExtractOrdersOptions = {}
): Promise<ExtractedMeeshoOrder[]> {
  const targetTabs = options.tabs && options.tabs.length > 0
    ? options.tabs
    : (['pending', 'ready-to-ship', 'shipped', 'cancelled'] as const);

  const totalLimit = options.limit || 500;
  const maxPerTab = options.maxOrdersPerTab || Math.max(10, Math.ceil(totalLimit / targetTabs.length));

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

        const subOrdersRaw = responseData.data?.subOrders || {};
        const subOrdersList: any[] = Array.isArray(subOrdersRaw)
          ? subOrdersRaw
          : Object.values(subOrdersRaw);

        console.log(
          `[Order Extractor] [${tabName}] Page ${pageNumber}: fetched ${subOrdersList.length} subOrders (total available in tab: ${responseData.total_count ?? 'unknown'})`
        );

        if (subOrdersList.length === 0) {
          break;
        }

        let tabExhaustedByCutoff = false;
        for (const raw of subOrdersList) {
          if (
            options.cutoffIso &&
            (tabName === 'shipped' || tabName === 'cancelled') &&
            raw.created_iso
          ) {
            const orderTime = new Date(raw.created_iso).getTime();
            const cutoffTime = new Date(options.cutoffIso).getTime();
            if (!isNaN(orderTime) && !isNaN(cutoffTime) && orderTime < cutoffTime) {
              console.log(
                `[Order Extractor] [${tabName}] Order created before cutoff (${raw.created_iso} < ${options.cutoffIso}). Halting tab pagination.`
              );
              tabExhaustedByCutoff = true;
              break;
            }
          }

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

        if (tabExhaustedByCutoff) {
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

