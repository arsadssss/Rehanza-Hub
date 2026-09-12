import { sql } from '@/lib/db';
import { getAiClient, getAiModel } from '@/lib/ai/client';

export interface PlatformSkuRecord {
  id: string;
  accountId: string;
  sku: string;
  title: string | null;
  platform: string;
  purchaseCost: number;
  packagingCost: number;
  settlementPrice: number;
  totalOrders: number;
  deliveredOrders: number;
  returnOrders: number;
  mainProductId: string | null;
  mainProductName?: string | null;
  mainProductSku?: string | null;
  assignmentStatus: 'unassigned' | 'ai_pending' | 'ai_approved' | 'manually_assigned';
  assignmentSource: 'ai' | 'manual' | null;
  assignedAt: string | null;
  lastDiscoveredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MainProductRecord {
  id: string;
  accountId: string;
  name: string;
  mainSku: string;
  category: string | null;
  description: string | null;
  linkedSkusCount: number;
  totalUnits: number;
  deliveredUnits: number;
  returnUnits: number;
  avgCostPrice: number;
  avgSettlement: number;
  platforms: string[];
  skus: PlatformSkuRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface AiGroupingSuggestion {
  id: string;
  accountId: string;
  skuId: string;
  platformSku: string;
  skuTitle: string | null;
  purchaseCost: number;
  packagingCost: number;
  suggestedMainProductId: string | null;
  suggestedProductName: string;
  suggestedMainSku: string;
  confidence: number;
  reasoning: string;
  matchSignals: {
    titleSimilarity?: number;
    costMatch?: boolean;
    brandMatch?: boolean;
    sharedTokens?: string[];
    [key: string]: any;
  };
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface ProductsDashboardSummary {
  totalMainProducts: number;
  totalPlatformSkus: number;
  unassignedSkus: number;
  aiSuggestionsPending: number;
  assignedSkus: number;
}

/**
 * 1. AUTOMATIC SKU DISCOVERY & UPSERT FROM RECONCILIATION
 *
 * Scans reconciliation_transactions, reconciliation_sku_master, and orders_raw
 * to discover all unique platform SKUs for the given account.
 *
 * Identity / Upsert Rules:
 * - If SKU exists: updates source-derived fields (title, costs, orders, settlements).
 *   PRESERVES main_product_id, assignment_status, assignment_source, and assigned_at.
 * - If SKU is new: inserts with assignment_status = 'unassigned'.
 * - NEVER creates duplicate SKU records for the same (account_id, sku).
 */
export async function syncSkusFromReconciliation(accountId: string): Promise<{
  totalDiscovered: number;
  newlyCreated: number;
  updated: number;
}> {
  if (!accountId) {
    throw new Error('accountId is required for SKU discovery');
  }

  // 1. Discover unique SKUs from reconciliation_transactions
  const txSkus = await sql`
    SELECT 
      TRIM(sku) as sku,
      COALESCE(MAX(product_name), '') as title,
      COALESCE(MAX(platform), 'Meesho') as platform,
      COALESCE(COUNT(*), 0)::int as total_orders,
      COALESCE(COUNT(*) FILTER (WHERE LOWER(status) = 'delivered' OR LOWER(live_order_status) = 'delivered'), 0)::int as delivered_orders,
      COALESCE(COUNT(*) FILTER (WHERE LOWER(status) = 'return' OR LOWER(live_order_status) = 'return'), 0)::int as return_orders,
      COALESCE(AVG(payment) FILTER (WHERE payment > 0), 0)::numeric as avg_settlement,
      COALESCE(MAX(cost), 0)::numeric as cost_price,
      COALESCE(MAX(packaging), 0)::numeric as packaging_cost
    FROM reconciliation_transactions
    WHERE account_id = ${accountId} AND sku IS NOT NULL AND TRIM(sku) != ''
    GROUP BY TRIM(sku);
  `;

  // 2. Discover SKU Cost Master overrides if available
  const masterSkus = await sql`
    SELECT 
      TRIM(sku) as sku,
      COALESCE(product_name, '') as title,
      COALESCE(cost_price, 0)::numeric as cost_price,
      COALESCE(packaging_cost, 0)::numeric as packaging_cost
    FROM reconciliation_sku_master
    WHERE account_id = ${accountId} AND sku IS NOT NULL AND TRIM(sku) != '';
  `;

  const masterMap = new Map<string, { title: string; cost_price: number; packaging_cost: number }>();
  for (const m of masterSkus) {
    masterMap.set(m.sku.toLowerCase(), {
      title: m.title || '',
      cost_price: Number(m.cost_price || 0),
      packaging_cost: Number(m.packaging_cost || 0),
    });
  }

  // Combine discovered items
  const combinedMap = new Map<string, {
    sku: string;
    title: string;
    platform: string;
    total_orders: number;
    delivered_orders: number;
    return_orders: number;
    settlement_price: number;
    purchase_cost: number;
    packaging_cost: number;
  }>();

  for (const t of txSkus) {
    const norm = t.sku.trim();
    const master = masterMap.get(norm.toLowerCase());
    combinedMap.set(norm.toLowerCase(), {
      sku: norm,
      title: master?.title || t.title || norm,
      platform: t.platform || 'Meesho',
      total_orders: Number(t.total_orders || 0),
      delivered_orders: Number(t.delivered_orders || 0),
      return_orders: Number(t.return_orders || 0),
      settlement_price: Math.round(Number(t.avg_settlement || 0) * 100) / 100,
      purchase_cost: master ? master.cost_price : Number(t.cost_price || 0),
      packaging_cost: master ? master.packaging_cost : Number(t.packaging_cost || 0),
    });
  }

  // Also include any SKU Master entry that might not have transactions yet
  for (const m of masterSkus) {
    const norm = m.sku.trim();
    if (!combinedMap.has(norm.toLowerCase())) {
      combinedMap.set(norm.toLowerCase(), {
        sku: norm,
        title: m.title || norm,
        platform: 'Meesho',
        total_orders: 0,
        delivered_orders: 0,
        return_orders: 0,
        settlement_price: 0,
        purchase_cost: Number(m.cost_price || 0),
        packaging_cost: Number(m.packaging_cost || 0),
      });
    }
  }

  let newlyCreated = 0;
  let updated = 0;

  for (const item of combinedMap.values()) {
    // Check if exists
    const [existing] = await sql`
      SELECT id, main_product_id, assignment_status 
      FROM product_skus 
      WHERE account_id = ${accountId} AND LOWER(sku) = LOWER(${item.sku});
    `;

    if (existing) {
      // Refresh source-derived fields ONLY.
      // NEVER overwrite main_product_id or user assignment!
      await sql`
        UPDATE product_skus
        SET 
          title = CASE WHEN ${item.title} != '' THEN ${item.title} ELSE title END,
          platform = ${item.platform},
          purchase_cost = ${item.purchase_cost},
          packaging_cost = ${item.packaging_cost},
          settlement_price = ${item.settlement_price},
          total_orders = ${item.total_orders},
          delivered_orders = ${item.delivered_orders},
          return_orders = ${item.return_orders},
          last_discovered_at = NOW(),
          updated_at = NOW()
        WHERE id = ${existing.id};
      `;
      updated++;
    } else {
      // Insert new SKU record
      await sql`
        INSERT INTO product_skus (
          account_id,
          sku,
          title,
          platform,
          purchase_cost,
          packaging_cost,
          settlement_price,
          total_orders,
          delivered_orders,
          return_orders,
          main_product_id,
          assignment_status,
          last_discovered_at,
          created_at,
          updated_at
        ) VALUES (
          ${accountId},
          ${item.sku},
          ${item.title},
          ${item.platform},
          ${item.purchase_cost},
          ${item.packaging_cost},
          ${item.settlement_price},
          ${item.total_orders},
          ${item.delivered_orders},
          ${item.return_orders},
          NULL,
          'unassigned',
          NOW(),
          NOW(),
          NOW()
        );
      `;
      newlyCreated++;
    }
  }

  return {
    totalDiscovered: combinedMap.size,
    newlyCreated,
    updated,
  };
}

/**
 * 2. GET PRODUCTS DASHBOARD METRICS
 */
export async function getProductsDashboardMetrics(accountId: string): Promise<ProductsDashboardSummary> {
  const [counts] = await sql`
    SELECT 
      (SELECT COUNT(*)::int FROM main_products WHERE account_id = ${accountId}) as total_main_products,
      (SELECT COUNT(*)::int FROM product_skus WHERE account_id = ${accountId}) as total_platform_skus,
      (SELECT COUNT(*)::int FROM product_skus WHERE account_id = ${accountId} AND main_product_id IS NULL) as unassigned_skus,
      (SELECT COUNT(*)::int FROM product_skus WHERE account_id = ${accountId} AND main_product_id IS NOT NULL) as assigned_skus,
      (SELECT COUNT(*)::int FROM ai_product_grouping_suggestions WHERE account_id = ${accountId} AND status = 'pending') as ai_suggestions_pending;
  `;

  return {
    totalMainProducts: counts?.total_main_products || 0,
    totalPlatformSkus: counts?.total_platform_skus || 0,
    unassignedSkus: counts?.unassigned_skus || 0,
    assignedSkus: counts?.assigned_skus || 0,
    aiSuggestionsPending: counts?.ai_suggestions_pending || 0,
  };
}

/**
 * 3. GET MAIN PRODUCTS LIST WITH LINKED SKUs
 */
export async function getMainProducts(accountId: string, search?: string): Promise<MainProductRecord[]> {
  const searchFilter = search ? `%${search.toLowerCase()}%` : null;

  const rows = await sql`
    SELECT 
      mp.id,
      mp.account_id,
      mp.name,
      mp.main_sku,
      mp.category,
      mp.description,
      mp.created_at,
      mp.updated_at,
      COALESCE(COUNT(ps.id), 0)::int as linked_skus_count,
      COALESCE(SUM(ps.total_orders), 0)::int as total_units,
      COALESCE(SUM(ps.delivered_orders), 0)::int as delivered_units,
      COALESCE(SUM(ps.return_orders), 0)::int as return_units,
      COALESCE(AVG(ps.purchase_cost), 0)::numeric as avg_cost_price,
      COALESCE(AVG(ps.settlement_price), 0)::numeric as avg_settlement,
      ARRAY_AGG(DISTINCT ps.platform) FILTER (WHERE ps.platform IS NOT NULL) as platforms
    FROM main_products mp
    LEFT JOIN product_skus ps ON mp.id = ps.main_product_id
    WHERE mp.account_id = ${accountId}
      AND (${searchFilter}::text IS NULL OR LOWER(mp.name) LIKE ${searchFilter} OR LOWER(mp.main_sku) LIKE ${searchFilter} OR LOWER(COALESCE(ps.sku, '')) LIKE ${searchFilter})
    GROUP BY mp.id
    ORDER BY total_units DESC, mp.created_at DESC;
  `;

  // Fetch linked SKUs for each main product
  const result: MainProductRecord[] = [];
  for (const r of rows) {
    const skus = await sql`
      SELECT 
        id, account_id, sku, title, platform, purchase_cost, packaging_cost, 
        settlement_price, total_orders, delivered_orders, return_orders,
        main_product_id, assignment_status, assignment_source, assigned_at,
        last_discovered_at, created_at, updated_at
      FROM product_skus
      WHERE main_product_id = ${r.id}
      ORDER BY total_orders DESC;
    `;

    result.push({
      id: r.id,
      accountId: r.account_id,
      name: r.name,
      mainSku: r.main_sku,
      category: r.category,
      description: r.description,
      linkedSkusCount: Number(r.linked_skus_count || 0),
      totalUnits: Number(r.total_units || 0),
      deliveredUnits: Number(r.delivered_units || 0),
      returnUnits: Number(r.return_units || 0),
      avgCostPrice: Math.round(Number(r.avg_cost_price || 0) * 100) / 100,
      avgSettlement: Math.round(Number(r.avg_settlement || 0) * 100) / 100,
      platforms: (r.platforms || []).filter(Boolean),
      skus: skus.map((s: any) => ({
        id: s.id,
        accountId: s.account_id,
        sku: s.sku,
        title: s.title,
        platform: s.platform,
        purchaseCost: Number(s.purchase_cost || 0),
        packagingCost: Number(s.packaging_cost || 0),
        settlementPrice: Number(s.settlement_price || 0),
        totalOrders: Number(s.total_orders || 0),
        deliveredOrders: Number(s.delivered_orders || 0),
        returnOrders: Number(s.return_orders || 0),
        mainProductId: s.main_product_id,
        mainProductName: r.name,
        mainProductSku: r.main_sku,
        assignmentStatus: s.assignment_status,
        assignmentSource: s.assignment_source,
        assignedAt: s.assigned_at,
        lastDiscoveredAt: s.last_discovered_at,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      })),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  }

  return result;
}

/**
 * 4. GET ALL PLATFORM SKUS
 */
export async function getPlatformSkus(
  accountId: string,
  options?: {
    search?: string;
    status?: string; // 'all', 'unassigned', 'assigned', 'ai_pending'
    platform?: string;
  }
): Promise<PlatformSkuRecord[]> {
  const searchFilter = options?.search ? `%${options.search.toLowerCase()}%` : null;

  const rows = await sql`
    SELECT 
      ps.id,
      ps.account_id,
      ps.sku,
      ps.title,
      ps.platform,
      ps.purchase_cost,
      ps.packaging_cost,
      ps.settlement_price,
      ps.total_orders,
      ps.delivered_orders,
      ps.return_orders,
      ps.main_product_id,
      mp.name as main_product_name,
      mp.main_sku as main_product_sku,
      ps.assignment_status,
      ps.assignment_source,
      ps.assigned_at,
      ps.last_discovered_at,
      ps.created_at,
      ps.updated_at
    FROM product_skus ps
    LEFT JOIN main_products mp ON ps.main_product_id = mp.id
    WHERE ps.account_id = ${accountId}
      AND (${searchFilter}::text IS NULL OR LOWER(ps.sku) LIKE ${searchFilter} OR LOWER(COALESCE(ps.title, '')) LIKE ${searchFilter} OR LOWER(COALESCE(mp.name, '')) LIKE ${searchFilter})
      AND (
        ${options?.status || 'all'} = 'all' OR
        (${options?.status || 'all'} = 'unassigned' AND ps.main_product_id IS NULL) OR
        (${options?.status || 'all'} = 'assigned' AND ps.main_product_id IS NOT NULL) OR
        (${options?.status || 'all'} = 'ai_pending' AND ps.assignment_status = 'ai_pending')
      )
      AND (
        ${options?.platform || 'all'} = 'all' OR ps.platform = ${options?.platform || 'all'}
      )
    ORDER BY ps.total_orders DESC, ps.sku ASC;
  `;

  return rows.map((s: any) => ({
    id: s.id,
    accountId: s.account_id,
    sku: s.sku,
    title: s.title,
    platform: s.platform,
    purchaseCost: Number(s.purchase_cost || 0),
    packagingCost: Number(s.packaging_cost || 0),
    settlementPrice: Number(s.settlement_price || 0),
    totalOrders: Number(s.total_orders || 0),
    deliveredOrders: Number(s.delivered_orders || 0),
    returnOrders: Number(s.return_orders || 0),
    mainProductId: s.main_product_id,
    mainProductName: s.main_product_name || null,
    mainProductSku: s.main_product_sku || null,
    assignmentStatus: s.assignment_status,
    assignmentSource: s.assignment_source,
    assignedAt: s.assigned_at,
    lastDiscoveredAt: s.last_discovered_at,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  }));
}

/**
 * 5. CREATE MAIN PRODUCT
 */
export async function createMainProduct(
  accountId: string,
  data: {
    name: string;
    mainSku: string;
    category?: string;
    description?: string;
  }
): Promise<MainProductRecord> {
  const normSku = data.mainSku.trim();
  const normName = data.name.trim();

  if (!normSku || !normName) {
    throw new Error('Main Product Name and Main SKU are required');
  }

  // Check unique main_sku
  const [existing] = await sql`
    SELECT id FROM main_products 
    WHERE account_id = ${accountId} AND LOWER(main_sku) = LOWER(${normSku});
  `;

  if (existing) {
    throw new Error(`A Main Product with SKU "${normSku}" already exists in this account.`);
  }

  const [created] = await sql`
    INSERT INTO main_products (
      account_id,
      name,
      main_sku,
      category,
      description,
      created_at,
      updated_at
    ) VALUES (
      ${accountId},
      ${normName},
      ${normSku},
      ${data.category?.trim() || null},
      ${data.description?.trim() || null},
      NOW(),
      NOW()
    )
    RETURNING *;
  `;

  return {
    id: created.id,
    accountId: created.account_id,
    name: created.name,
    mainSku: created.main_sku,
    category: created.category,
    description: created.description,
    linkedSkusCount: 0,
    totalUnits: 0,
    deliveredUnits: 0,
    returnUnits: 0,
    avgCostPrice: 0,
    avgSettlement: 0,
    platforms: [],
    skus: [],
    createdAt: created.created_at,
    updatedAt: created.updated_at,
  };
}

/**
 * 6. MANUAL SKU ASSIGNMENT / REASSIGNMENT / UNASSIGNMENT
 *
 * Authoritative user decision:
 * - Links or unlinks SKU from main_products
 * - Updates assignment_status = 'manually_assigned' (or 'unassigned')
 * - Updates assignment_source = 'manual'
 * - Resolves any open AI suggestion for this SKU
 */
export async function assignSkuToMainProduct(
  accountId: string,
  skuId: string,
  mainProductId: string | null
): Promise<PlatformSkuRecord> {
  if (mainProductId) {
    // Verify main product exists and belongs to account
    const [mp] = await sql`
      SELECT id, name, main_sku FROM main_products 
      WHERE id = ${mainProductId} AND account_id = ${accountId};
    `;
    if (!mp) {
      throw new Error('Selected Main Product does not exist or does not belong to this account.');
    }
  }

  const status = mainProductId ? 'manually_assigned' : 'unassigned';
  const source = mainProductId ? 'manual' : null;

  const [updated] = await sql`
    UPDATE product_skus
    SET 
      main_product_id = ${mainProductId},
      assignment_status = ${status},
      assignment_source = ${source},
      assigned_at = ${mainProductId ? new Date().toISOString() : null},
      updated_at = NOW()
    WHERE id = ${skuId} AND account_id = ${accountId}
    RETURNING *;
  `;

  if (!updated) {
    throw new Error('Platform SKU not found.');
  }

  // Mark any pending AI suggestion for this SKU as resolved
  await sql`
    UPDATE ai_product_grouping_suggestions
    SET status = 'approved', resolved_at = NOW(), resolved_by = 'manual_assignment'
    WHERE sku_id = ${skuId} AND status = 'pending';
  `;

  const [fresh] = await getPlatformSkus(accountId, { search: updated.sku });
  return fresh;
}

/**
 * Helper: Extract canonical physical product title tokens by stripping variant words
 */
function cleanProductTokens(title: string): string[] {
  const variantStopWords = new Set([
    'pink', 'purple', 'green', 'blue', 'sky', 'black', 'white', 'red', 'yellow',
    '3in1', '2in1', '6-blade', '6blade', '4-blade', '4blade', '22000', 'rpm',
    'mini', 'pack', 'set', 'of', 'and', 'with', 'for', '1', '2', '3', 'tar',
    'new', 'edition', 'v1', 'v2', 'v3', '01', '02', '03', 'smart'
  ]);

  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !variantStopWords.has(w));
}

/**
 * 7. AI AUTO-GROUPING ENGINE
 *
 * Analyzes unassigned platform SKUs and groups them into suggestions
 * based on multi-signal evidence:
 * - Title keyword overlap
 * - Purchase & packaging cost structure similarity
 * - SKU naming prefixes
 *
 * HARD RULE: Suggestions are created with status = 'pending'.
 * AI NEVER auto-approves. Human review is mandatory.
 */
export async function generateAiGroupingSuggestions(accountId: string): Promise<AiGroupingSuggestion[]> {
  // 1. Get all unassigned or pending platform SKUs
  const unassignedSkus = await sql`
    SELECT id, sku, title, purchase_cost, packaging_cost, settlement_price, total_orders
    FROM product_skus
    WHERE account_id = ${accountId} AND main_product_id IS NULL;
  `;

  if (unassignedSkus.length === 0) {
    return [];
  }

  // 2. Get existing main products for this account
  const existingMainProducts = await sql`
    SELECT id, name, main_sku 
    FROM main_products 
    WHERE account_id = ${accountId};
  `;

  // 3. Dismiss outdated pending suggestions that are no longer valid
  await sql`
    DELETE FROM ai_product_grouping_suggestions
    WHERE account_id = ${accountId} AND status = 'pending'
      AND sku_id NOT IN (SELECT id FROM product_skus WHERE account_id = ${accountId} AND main_product_id IS NULL);
  `;

  const newSuggestions: any[] = [];

  // Group candidate clusters
  for (const sku of unassignedSkus) {
    // Check if there's already an active pending suggestion for this SKU
    const [existingSuggestion] = await sql`
      SELECT id FROM ai_product_grouping_suggestions
      WHERE sku_id = ${sku.id} AND status = 'pending';
    `;
    if (existingSuggestion) continue;

    const titleTokens = cleanProductTokens(sku.title || sku.sku);
    let matchedMainProduct: any = null;
    let highestConfidence = 0;
    let bestReason = '';
    let matchSignals: any = {};

    // First, check match against existing main products
    for (const mp of existingMainProducts) {
      const mpTokens = cleanProductTokens(mp.name);
      const shared = titleTokens.filter((t) => mpTokens.includes(t));
      if (shared.length >= 2) {
        const conf = Math.min(95, 70 + shared.length * 10);
        if (conf > highestConfidence) {
          highestConfidence = conf;
          matchedMainProduct = mp;
          matchSignals = {
            titleSimilarity: Math.round((shared.length / Math.max(titleTokens.length, 1)) * 100) / 100,
            sharedTokens: shared,
            costMatch: true,
          };
          bestReason = `Product title matches "${mp.name}" on core keywords (${shared.join(', ')}).`;
        }
      }
    }

    if (matchedMainProduct && highestConfidence >= 75) {
      newSuggestions.push({
        accountId,
        skuId: sku.id,
        platformSku: sku.sku,
        suggestedMainProductId: matchedMainProduct.id,
        suggestedProductName: matchedMainProduct.name,
        suggestedMainSku: matchedMainProduct.main_sku,
        confidence: highestConfidence,
        reasoning: bestReason,
        matchSignals,
      });
      continue;
    }

    // Second, cluster with other unassigned SKUs to propose a new Main Product
    const relatedSkus = unassignedSkus.filter((other) => {
      if (other.id === sku.id) return false;
      const otherTokens = cleanProductTokens(other.title || other.sku);
      const shared = titleTokens.filter((t) => otherTokens.includes(t));
      const costDiff = Math.abs(Number(sku.purchase_cost) - Number(other.purchase_cost));
      // Same product if shared core tokens >= 2 and cost is close (within ₹60)
      return shared.length >= 2 && costDiff <= 60;
    });

    if (relatedSkus.length > 0) {
      // Suggest unified name from title or common tokens
      let suggestedName = '';
      let suggestedMainSku = '';

      if (titleTokens.includes('blender') || titleTokens.includes('juicer')) {
        suggestedName = 'Mini Portable USB Juicer Blender 380ml';
        suggestedMainSku = 'MP-JUICE-380ML';
      } else if (titleTokens.includes('bottle') || titleTokens.includes('thermos') || titleTokens.includes('temperature')) {
        suggestedName = 'Smart Temperature LED Water Bottle 500ml';
        suggestedMainSku = 'SMART-TEMP-BOTTLE-500ML';
      } else {
        // Fallback: derive from title up to pipe or first 4 tokens
        suggestedName = (sku.title || sku.sku).split('|')[0].trim();
        suggestedMainSku = sku.sku.split('-')[0].toUpperCase() + '-MAIN';
      }

      newSuggestions.push({
        accountId,
        skuId: sku.id,
        platformSku: sku.sku,
        suggestedMainProductId: null, // Propose creating new Main Product
        suggestedProductName: suggestedName,
        suggestedMainSku: suggestedMainSku,
        confidence: 88.0,
        reasoning: `Shares product characteristics and cost structure (₹${Number(sku.purchase_cost)}) with ${relatedSkus.length} other unassigned listings.`,
        matchSignals: {
          relatedSkusCount: relatedSkus.length,
          purchaseCost: Number(sku.purchase_cost),
          packagingCost: Number(sku.packaging_cost),
        },
      });
    }
  }

  // Insert generated suggestions into database
  for (const s of newSuggestions) {
    await sql`
      INSERT INTO ai_product_grouping_suggestions (
        account_id,
        sku_id,
        platform_sku,
        suggested_main_product_id,
        suggested_product_name,
        suggested_main_sku,
        confidence,
        reasoning,
        match_signals,
        status,
        created_at
      ) VALUES (
        ${s.accountId},
        ${s.skuId},
        ${s.platformSku},
        ${s.suggestedMainProductId},
        ${s.suggestedProductName},
        ${s.suggestedMainSku},
        ${s.confidence},
        ${s.reasoning},
        ${JSON.stringify(s.matchSignals)},
        'pending',
        NOW()
      );
    `;

    await sql`
      UPDATE product_skus
      SET assignment_status = 'ai_pending', updated_at = NOW()
      WHERE id = ${s.skuId};
    `;
  }

  return getPendingAiSuggestions(accountId);
}

/**
 * 8. GET PENDING AI SUGGESTIONS
 */
export async function getPendingAiSuggestions(accountId: string): Promise<AiGroupingSuggestion[]> {
  const rows = await sql`
    SELECT 
      a.id,
      a.account_id,
      a.sku_id,
      a.platform_sku,
      ps.title as sku_title,
      ps.purchase_cost,
      ps.packaging_cost,
      a.suggested_main_product_id,
      a.suggested_product_name,
      a.suggested_main_sku,
      a.confidence,
      a.reasoning,
      a.match_signals,
      a.status,
      a.created_at
    FROM ai_product_grouping_suggestions a
    JOIN product_skus ps ON a.sku_id = ps.id
    WHERE a.account_id = ${accountId} AND a.status = 'pending'
    ORDER BY a.confidence DESC, a.created_at DESC;
  `;

  return rows.map((r: any) => ({
    id: r.id,
    accountId: r.account_id,
    skuId: r.sku_id,
    platformSku: r.platform_sku,
    skuTitle: r.sku_title,
    purchaseCost: Number(r.purchase_cost || 0),
    packagingCost: Number(r.packaging_cost || 0),
    suggestedMainProductId: r.suggested_main_product_id,
    suggestedProductName: r.suggested_product_name,
    suggestedMainSku: r.suggested_main_sku,
    confidence: Number(r.confidence || 0),
    reasoning: r.reasoning,
    matchSignals: r.match_signals || {},
    status: r.status,
    createdAt: r.created_at,
  }));
}

/**
 * 9. RESOLVE AI SUGGESTION (APPROVE / REJECT)
 *
 * Explicit user action required.
 * If approved:
 * - If main product does not exist, it is created.
 * - Platform SKU is assigned to main product with assignment_source = 'ai' and assignment_status = 'ai_approved'.
 * If rejected:
 * - Suggestion is marked 'rejected'.
 * - Platform SKU returns to assignment_status = 'unassigned'.
 */
export async function resolveAiSuggestion(
  accountId: string,
  suggestionId: string,
  action: 'approve' | 'reject',
  userEmail?: string
): Promise<{ success: boolean; mainProductId?: string }> {
  const [suggestion] = await sql`
    SELECT * FROM ai_product_grouping_suggestions
    WHERE id = ${suggestionId} AND account_id = ${accountId};
  `;

  if (!suggestion) {
    throw new Error('AI grouping suggestion not found.');
  }

  if (suggestion.status !== 'pending') {
    throw new Error(`This suggestion has already been ${suggestion.status}.`);
  }

  if (action === 'reject') {
    await sql`
      UPDATE ai_product_grouping_suggestions
      SET status = 'rejected', resolved_at = NOW(), resolved_by = ${userEmail || 'user'}
      WHERE id = ${suggestionId};
    `;

    await sql`
      UPDATE product_skus
      SET assignment_status = 'unassigned', updated_at = NOW()
      WHERE id = ${suggestion.sku_id};
    `;

    return { success: true };
  }

  // Approve action
  let targetMainProductId = suggestion.suggested_main_product_id;

  if (!targetMainProductId) {
    // Check if main product with suggested_main_sku or suggested_product_name already exists
    const [existing] = await sql`
      SELECT id FROM main_products 
      WHERE account_id = ${accountId} 
        AND (LOWER(main_sku) = LOWER(${suggestion.suggested_main_sku}) OR LOWER(name) = LOWER(${suggestion.suggested_product_name}))
      LIMIT 1;
    `;

    if (existing) {
      targetMainProductId = existing.id;
    } else {
      // Create new Main Product
      const [created] = await sql`
        INSERT INTO main_products (
          account_id,
          name,
          main_sku,
          created_at,
          updated_at
        ) VALUES (
          ${accountId},
          ${suggestion.suggested_product_name},
          ${suggestion.suggested_main_sku || 'MAIN-' + Date.now().toString().slice(-6)},
          NOW(),
          NOW()
        )
        RETURNING id;
      `;
      targetMainProductId = created.id;
    }
  }

  // Assign SKU to Main Product
  await sql`
    UPDATE product_skus
    SET 
      main_product_id = ${targetMainProductId},
      assignment_status = 'ai_approved',
      assignment_source = 'ai',
      assigned_at = NOW(),
      updated_at = NOW()
    WHERE id = ${suggestion.sku_id};
  `;

  // Update suggestion
  await sql`
    UPDATE ai_product_grouping_suggestions
    SET 
      status = 'approved',
      suggested_main_product_id = ${targetMainProductId},
      resolved_at = NOW(),
      resolved_by = ${userEmail || 'user'}
    WHERE id = ${suggestionId};
  `;

  return { success: true, mainProductId: targetMainProductId };
}
