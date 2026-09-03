import { sql } from '@/lib/db';

export interface SkuMasterItem {
  id: number;
  accountId: string;
  sku: string;
  productName: string | null;
  category: string | null;
  costPrice: number;
  packagingCost: number;
  costStatus: 'configured' | 'pending';
  totalOrders: number;
  totalQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface SkuMasterSummary {
  totalSkus: number;
  configuredSkus: number;
  pendingSkus: number;
}

export interface SkuMasterListResult {
  summary: SkuMasterSummary;
  skus: SkuMasterItem[];
}

export interface SkuSyncResult {
  configuredCount: number;
  pendingCount: number;
  newCount: number;
  requiresCostSetup: boolean;
}

/**
 * Normalizes SKU string consistently (trimmed, sanitized whitespace)
 */
export function normalizeSku(sku: string | null | undefined): string {
  if (!sku) return '';
  return String(sku).trim().replace(/\s+/g, ' ');
}

/**
 * Bulk detects and synchronizes SKUs from order rows into reconciliation_sku_master.
 * - Detects already configured SKUs
 * - Detects existing pending SKUs
 * - Creates completely new SKUs as 'pending'
 * - Does NOT duplicate records
 * - Preserves account isolation
 * - Preserves existing manual product names
 * - Executes in ONE bulk read and ONE bulk insert
 */
export async function syncSkusFromOrders(
  accountId: string,
  orders: Array<{ sku: string; productName?: string | null }>
): Promise<SkuSyncResult> {
  if (!accountId) {
    throw new Error('Account ID is required for SKU sync');
  }

  // 1. Extract unique SKUs and their primary product name from order rows
  const orderSkuMap = new Map<string, { rawSku: string; productName: string | null }>();
  for (const ord of orders) {
    const norm = normalizeSku(ord.sku);
    if (!norm) continue;
    const lowerKey = norm.toLowerCase();
    if (!orderSkuMap.has(lowerKey)) {
      orderSkuMap.set(lowerKey, {
        rawSku: norm,
        productName: ord.productName ? String(ord.productName).trim() : null,
      });
    }
  }

  if (orderSkuMap.size === 0) {
    return {
      configuredCount: 0,
      pendingCount: 0,
      newCount: 0,
      requiresCostSetup: false,
    };
  }

  // 2. Perform ONE bulk query against reconciliation_sku_master for this account
  const existingRecords = await sql`
    SELECT id, sku, product_name, cost_price, packaging_cost, cost_status
    FROM reconciliation_sku_master
    WHERE account_id = ${accountId}
  `;

  const existingMap = new Map<string, any>();
  for (const rec of existingRecords) {
    const key = normalizeSku(rec.sku).toLowerCase();
    existingMap.set(key, rec);
  }

  let configuredCount = 0;
  let existingPendingCount = 0;
  const newSkusToInsert: Array<{ sku: string; productName: string | null }> = [];

  for (const [lowerKey, data] of orderSkuMap.entries()) {
    const existing = existingMap.get(lowerKey);
    if (existing) {
      const isConfigured =
        existing.cost_status === 'configured' &&
        existing.cost_price !== null &&
        Number(existing.cost_price) >= 0 &&
        existing.packaging_cost !== null &&
        Number(existing.packaging_cost) >= 0;

      if (isConfigured) {
        configuredCount++;
      } else {
        existingPendingCount++;
      }
    } else {
      newSkusToInsert.push({
        sku: data.rawSku,
        productName: data.productName,
      });
    }
  }

  // 3. Perform ONE bulk insert for completely new SKUs (if any)
  if (newSkusToInsert.length > 0) {
    for (const item of newSkusToInsert) {
      await sql`
        INSERT INTO reconciliation_sku_master (
          account_id,
          sku,
          product_name,
          cost_price,
          packaging_cost,
          packing,
          cost_status,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          ${accountId},
          ${item.sku},
          ${item.productName},
          0,
          0,
          0,
          'pending',
          true,
          NOW(),
          NOW()
        )
        ON CONFLICT (account_id, sku) DO NOTHING;
      `;
    }
  }

  const totalPending = existingPendingCount + newSkusToInsert.length;
  return {
    configuredCount,
    pendingCount: totalPending,
    newCount: newSkusToInsert.length,
    requiresCostSetup: totalPending > 0,
  };
}

/**
 * Detect and sync SKUs from existing raw orders in the database for the given account.
 */
export async function syncSkusFromExistingRawOrders(accountId: string): Promise<SkuSyncResult> {
  const rawOrders = await sql`
    SELECT o.sku, o.product_name
    FROM reconciliation_orders_raw o
    JOIN reconciliation_uploads u ON o.upload_id = u.id
    WHERE u.account_id = ${accountId}
      AND o.sku IS NOT NULL AND o.sku != '';
  `;

  return syncSkusFromOrders(
    accountId,
    rawOrders.map((r: any) => ({ sku: r.sku, productName: r.product_name }))
  );
}

/**
 * Retrieve SKU master list with aggregated order count and quantity
 */
export async function getSkuMasterList(
  accountId: string,
  options?: {
    search?: string;
    status?: 'all' | 'configured' | 'pending';
    limit?: number;
    offset?: number;
  }
): Promise<SkuMasterListResult> {
  if (!accountId) {
    throw new Error('Account ID is required to fetch SKU master');
  }

  // Make sure existing raw order SKUs are registered in the master
  await syncSkusFromExistingRawOrders(accountId);

  const search = options?.search ? `%${options.search.trim().toLowerCase()}%` : null;
  const status = options?.status || 'all';
  const limit = options?.limit || 100;
  const offset = options?.offset || 0;

  // Query SKU master with aggregations from reconciliation_transactions
  const rows = await sql`
    SELECT 
      m.id,
      m.account_id,
      m.sku,
      m.product_name,
      m.category,
      COALESCE(m.cost_price, 0)::numeric AS cost_price,
      COALESCE(m.packaging_cost, m.packing, 0)::numeric AS packaging_cost,
      COALESCE(m.cost_status, 'pending') AS cost_status,
      m.created_at,
      m.updated_at,
      COALESCE(tx.order_count, 0)::int AS total_orders,
      COALESCE(tx.total_qty, 0)::numeric AS total_quantity
    FROM reconciliation_sku_master m
    LEFT JOIN (
      SELECT 
        LOWER(TRIM(t.sku)) as norm_sku,
        COUNT(t.id) as order_count,
        SUM(t.quantity) as total_qty
      FROM reconciliation_transactions t
      WHERE t.account_id = ${accountId}
      GROUP BY LOWER(TRIM(t.sku))
    ) tx ON LOWER(TRIM(m.sku)) = tx.norm_sku
    WHERE m.account_id = ${accountId}
      AND (${status} = 'all' OR (${status} = 'configured' AND m.cost_status = 'configured') OR (${status} = 'pending' AND (m.cost_status = 'pending' OR m.cost_status IS NULL)))
      AND (${search}::text IS NULL OR LOWER(m.sku) LIKE ${search} OR LOWER(COALESCE(m.product_name, '')) LIKE ${search})
    ORDER BY tx.order_count DESC NULLS LAST, m.sku ASC
    LIMIT ${limit} OFFSET ${offset};
  `;

  // Summary counts for this account
  const [summaryRow] = await sql`
    SELECT 
      COUNT(*)::int AS total_skus,
      COUNT(*) FILTER (WHERE cost_status = 'configured')::int AS configured_skus,
      COUNT(*) FILTER (WHERE cost_status = 'pending' OR cost_status IS NULL)::int AS pending_skus
    FROM reconciliation_sku_master
    WHERE account_id = ${accountId};
  `;

  const skus: SkuMasterItem[] = rows.map((r: any) => ({
    id: Number(r.id),
    accountId: r.account_id,
    sku: r.sku,
    productName: r.product_name,
    category: r.category,
    costPrice: Number(r.cost_price),
    packagingCost: Number(r.packaging_cost),
    costStatus: r.cost_status === 'configured' ? 'configured' : 'pending',
    totalOrders: Number(r.total_orders || 0),
    totalQuantity: Number(r.total_quantity || 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return {
    summary: {
      totalSkus: Number(summaryRow?.total_skus || 0),
      configuredSkus: Number(summaryRow?.configured_skus || 0),
      pendingSkus: Number(summaryRow?.pending_skus || 0),
    },
    skus,
  };
}

/**
 * Save or update SKU Cost & Packaging in reconciliation_sku_master.
 * Automatically recalculates affected transactions in reconciliation_transactions.
 */
export async function saveSkuCost(
  accountId: string,
  sku: string,
  data: {
    costPrice: number;
    packagingCost: number;
    productName?: string | null;
  }
): Promise<{
  success: boolean;
  sku: SkuMasterItem;
  affectedTransactions: number;
}> {
  if (!accountId) {
    throw new Error('Account ID is required');
  }

  const normSku = normalizeSku(sku);
  if (!normSku) {
    throw new Error('Valid SKU is required');
  }

  // Strict numerical validation
  const costPrice = Number(data.costPrice);
  const packagingCost = Number(data.packagingCost);

  if (isNaN(costPrice) || !isFinite(costPrice) || costPrice < 0) {
    throw new Error('Cost Price must be a valid non-negative number');
  }

  if (isNaN(packagingCost) || !isFinite(packagingCost) || packagingCost < 0) {
    throw new Error('Packaging Cost must be a valid non-negative number');
  }

  const trimmedProductName = data.productName ? String(data.productName).trim() : null;

  // Upsert into reconciliation_sku_master
  const [upserted] = await sql`
    INSERT INTO reconciliation_sku_master (
      account_id,
      sku,
      product_name,
      cost_price,
      packaging_cost,
      packing,
      cost_status,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      ${accountId},
      ${normSku},
      ${trimmedProductName},
      ${costPrice},
      ${packagingCost},
      ${packagingCost},
      'configured',
      true,
      NOW(),
      NOW()
    )
    ON CONFLICT (account_id, sku) DO UPDATE
    SET
      cost_price = EXCLUDED.cost_price,
      packaging_cost = EXCLUDED.packaging_cost,
      packing = EXCLUDED.packaging_cost,
      cost_status = 'configured',
      product_name = COALESCE(EXCLUDED.product_name, reconciliation_sku_master.product_name),
      updated_at = NOW()
    RETURNING *;
  `;

  // TARGETED SAFE RECALCULATION:
  // Recalculate only existing transactions matching this account and SKU
  const affectedTransactions = await recalculateTransactionsForSku(
    accountId,
    normSku,
    costPrice,
    packagingCost
  );

  return {
    success: true,
    sku: {
      id: Number(upserted.id),
      accountId: upserted.account_id,
      sku: upserted.sku,
      productName: upserted.product_name,
      category: upserted.category,
      costPrice: Number(upserted.cost_price),
      packagingCost: Number(upserted.packaging_cost),
      costStatus: upserted.cost_status,
      totalOrders: 0,
      totalQuantity: 0,
      createdAt: upserted.created_at,
      updatedAt: upserted.updated_at,
    },
    affectedTransactions,
  };
}

/**
 * Save SKU Cost by Master Record ID
 */
export async function saveSkuCostById(
  accountId: string,
  id: number,
  data: {
    costPrice: number;
    packagingCost: number;
    productName?: string | null;
  }
): Promise<{
  success: boolean;
  sku: SkuMasterItem;
  affectedTransactions: number;
}> {
  const [record] = await sql`
    SELECT sku FROM reconciliation_sku_master
    WHERE id = ${id} AND account_id = ${accountId};
  `;

  if (!record) {
    throw new Error(`SKU master record #${id} not found for this account`);
  }

  return saveSkuCost(accountId, record.sku, data);
}

/**
 * Safely recalculates affected transactions in reconciliation_transactions
 * for a specific account and SKU.
 *
 * Rules:
 * - quantity_cost = costPrice * quantity
 * - packaging = packagingCost * quantity
 * - Delivered / Exchange: profit = payment - quantity_cost - packaging
 * - Return: profit = payment - packaging
 * - Other statuses: profit = null
 * - Preserves all raw source relations and payment/settlement fields.
 */
export async function recalculateTransactionsForSku(
  accountId: string,
  sku: string,
  costPrice: number,
  packagingCost: number
): Promise<number> {
  const normSku = normalizeSku(sku);

  // Find all affected transactions for this account & SKU
  const txs = await sql`
    SELECT id, status, live_order_status, quantity, payment
    FROM reconciliation_transactions
    WHERE account_id = ${accountId}
      AND platform = 'Meesho'
      AND LOWER(TRIM(sku)) = LOWER(TRIM(${normSku}));
  `;

  if (txs.length === 0) {
    return 0;
  }

  // Update transactions in parallel chunks of 25
  const chunkSize = 25;
  let updatedCount = 0;

  for (let i = 0; i < txs.length; i += chunkSize) {
    const chunk = txs.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (tx: any) => {
        const qty = Number(tx.quantity) || 1;
        const newQuantityCost = costPrice * qty;
        const newPackaging = packagingCost * qty;

        const effectiveStatus = tx.status || 'Unknown';
        const paymentAmt = tx.payment !== null && tx.payment !== undefined
          ? Number(tx.payment)
          : null;

        let newProfit: number | null = null;
        if (paymentAmt !== null) {
          if (effectiveStatus === 'Delivered' || effectiveStatus === 'Exchange') {
            newProfit = paymentAmt - newQuantityCost - newPackaging;
          } else if (effectiveStatus === 'Return') {
            newProfit = paymentAmt - newPackaging;
          }
        }

        await sql`
          UPDATE reconciliation_transactions
          SET
            cost = ${costPrice},
            quantity_cost = ${newQuantityCost},
            packaging = ${newPackaging},
            profit = ${newProfit},
            updated_at = NOW()
          WHERE id = ${tx.id};
        `;
        updatedCount++;
      })
    );
  }

  return updatedCount;
}
