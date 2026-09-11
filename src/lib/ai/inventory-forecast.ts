import { sql } from "@/lib/db";
import { SkuInventoryForecast, InventoryForecastSummary, StockAlertLevel } from "./types";

/**
 * Deterministic Inventory & Demand Forecasting Engine for REHANZA-HUB.
 * Calculates exact historical velocity, runout days, and projected reorder needs
 * from live application data without LLM mathematical hallucinations.
 */
export async function calculateInventoryForecast(
  accountId: string,
  options: {
    forecastDays?: number;
    thresholdOverride?: number;
    targetSku?: string;
  } = {}
): Promise<InventoryForecastSummary> {
  const horizon = options.forecastDays || 30;

  // 1. Fetch current stock and variant masters
  const variants = await sql`
    SELECT 
      pv.id as variant_id,
      pv.variant_sku as sku,
      ap.product_name as "productName",
      COALESCE(pv.stock, 0)::int as stock,
      COALESCE(pv.low_stock_threshold, ${options.thresholdOverride || 15})::int as threshold,
      COALESCE(ap.cost_price, 0)::numeric as cost_price
    FROM product_variants pv
    JOIN allproducts ap ON pv.product_id = ap.id
    WHERE pv.account_id = ${accountId}
      AND pv.is_deleted = false
      AND ap.is_deleted = false
    ORDER BY pv.stock ASC, ap.product_name ASC
  `;

  // 2. Fetch sales velocity over last 30 days and 15-day sub-windows from reconciliation transactions
  // Also fallback to orders table if reconciliation rows are absent
  const [velocity30dRes, velocity15dRecentRes, velocity15dPriorRes] = await Promise.all([
    sql`
      SELECT 
        LOWER(TRIM(sku)) as sku,
        COALESCE(SUM(quantity), 0)::numeric as total_qty
      FROM reconciliation_transactions
      WHERE account_id = ${accountId}
        AND COALESCE(order_date, created_at) >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY LOWER(TRIM(sku))
    `,
    sql`
      SELECT 
        LOWER(TRIM(sku)) as sku,
        COALESCE(SUM(quantity), 0)::numeric as total_qty
      FROM reconciliation_transactions
      WHERE account_id = ${accountId}
        AND COALESCE(order_date, created_at) >= CURRENT_DATE - INTERVAL '15 days'
      GROUP BY LOWER(TRIM(sku))
    `,
    sql`
      SELECT 
        LOWER(TRIM(sku)) as sku,
        COALESCE(SUM(quantity), 0)::numeric as total_qty
      FROM reconciliation_transactions
      WHERE account_id = ${accountId}
        AND COALESCE(order_date, created_at) >= CURRENT_DATE - INTERVAL '30 days'
        AND COALESCE(order_date, created_at) < CURRENT_DATE - INTERVAL '15 days'
      GROUP BY LOWER(TRIM(sku))
    `,
  ]);

  const map30d = new Map<string, number>();
  velocity30dRes.forEach((r: any) => map30d.set(r.sku, Number(r.total_qty || 0)));

  const map15dRecent = new Map<string, number>();
  velocity15dRecentRes.forEach((r: any) => map15dRecent.set(r.sku, Number(r.total_qty || 0)));

  const map15dPrior = new Map<string, number>();
  velocity15dPriorRes.forEach((r: any) => map15dPrior.set(r.sku, Number(r.total_qty || 0)));

  // Fallback: If 30-day reconciliation velocity is empty, query all-time/orders table
  let fallbackMap = new Map<string, number>();
  if (map30d.size === 0) {
    const ordersRes = await sql`
      SELECT 
        LOWER(TRIM(pv.variant_sku)) as sku,
        COALESCE(SUM(o.quantity), 0)::numeric as total_qty
      FROM orders o
      JOIN product_variants pv ON o.variant_id = pv.id
      WHERE o.account_id = ${accountId}
        AND o.is_deleted = false
        AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY LOWER(TRIM(pv.variant_sku))
    `;
    ordersRes.forEach((r: any) => fallbackMap.set(r.sku, Number(r.total_qty || 0)));
  }

  let totalValuation = 0;
  const forecasts: SkuInventoryForecast[] = [];

  for (const v of variants) {
    const skuKey = (v.sku || "").toLowerCase().trim();
    const stock = Number(v.stock || 0);
    const costPrice = Number(v.cost_price || 0);
    const threshold = Number(v.threshold || 15);
    totalValuation += stock * costPrice;

    const units30d = map30d.get(skuKey) ?? fallbackMap.get(skuKey) ?? 0;
    const units15dRecent = map15dRecent.get(skuKey) || 0;
    const units15dPrior = map15dPrior.get(skuKey) || 0;

    // Daily Sales Velocity
    const dailySalesVelocity = units30d > 0 ? Math.round((units30d / 30) * 100) / 100 : 0;

    // Days Remaining
    let daysRemaining = 999;
    if (dailySalesVelocity > 0) {
      daysRemaining = Math.round((stock / dailySalesVelocity) * 10) / 10;
    } else if (stock === 0) {
      daysRemaining = 0;
    }

    // Trend Direction
    let trendDirection: "UPWARD" | "STABLE" | "DOWNWARD" = "STABLE";
    if (units15dRecent > units15dPrior * 1.2 && units15dRecent >= 3) {
      trendDirection = "UPWARD";
    } else if (units15dRecent < units15dPrior * 0.8 && units15dPrior >= 3) {
      trendDirection = "DOWNWARD";
    }

    // Status Level
    let status: StockAlertLevel = "HEALTHY";
    if (stock <= 0 || daysRemaining <= 10) {
      status = "CRITICAL";
    } else if (daysRemaining <= 25 || stock <= threshold) {
      status = "WARNING";
    }

    // Demand Projections
    const projected30DayDemand = Math.ceil(dailySalesVelocity * 30);
    const projected60DayDemand = Math.ceil(dailySalesVelocity * 60);
    const demandMin = Math.max(0, Math.floor(projected30DayDemand * 0.8));
    const demandMax = Math.ceil(projected30DayDemand * 1.25);

    // Recommended Reorder Quantity: target 45 days of supply minus current stock
    const targetSupplyUnits = Math.ceil(dailySalesVelocity * 45);
    const recommendedReorderQty = Math.max(
      0,
      dailySalesVelocity > 0
        ? Math.max(targetSupplyUnits - stock, threshold * 2)
        : stock <= threshold
        ? threshold * 2
        : 0
    );

    // Confidence
    let confidence: "Low" | "Medium" | "High" = "Low";
    if (units30d >= 20) confidence = "High";
    else if (units30d >= 5) confidence = "Medium";

    // Recommended Action
    let recommendedAction = "Maintain standard inventory monitoring.";
    if (stock <= 0) {
      recommendedAction = `STOCKOUT: Expedite reorder of ${recommendedReorderQty} units immediately to recover lost sales.`;
    } else if (status === "CRITICAL") {
      recommendedAction = `CRITICAL RUNOUT: Stock will exhaust in ~${daysRemaining} days. Reorder ${recommendedReorderQty} units immediately.`;
    } else if (status === "WARNING") {
      recommendedAction = `REORDER APPROACHING: Days remaining (${daysRemaining}d) approaching lead-time threshold. Issue PO for ${recommendedReorderQty} units.`;
    } else if (stock > targetSupplyUnits * 2 && stock > 50) {
      recommendedAction = `OVERSTOCK ALERT: ${daysRemaining} days of stock on hand. Pause reorders and bundle to liquidate capital.`;
    }

    forecasts.push({
      sku: v.sku,
      productName: v.productName,
      currentStock: stock,
      reorderThreshold: threshold,
      costPrice,
      totalUnitsSold30d: units30d,
      dailySalesVelocity,
      daysRemaining,
      status,
      trendDirection,
      projected30DayDemand,
      projected60DayDemand,
      demandRange: { min: demandMin, max: demandMax },
      recommendedReorderQty,
      recommendedAction,
      confidence,
    });
  }

  // Filter if target SKU specified
  let finalForecasts = forecasts;
  if (options.targetSku) {
    const target = options.targetSku.toLowerCase().trim();
    finalForecasts = forecasts.filter((f) => f.sku.toLowerCase().includes(target));
  }

  // Sort critical first, then warning, then ascending days remaining
  finalForecasts.sort((a, b) => {
    const priority = { CRITICAL: 0, WARNING: 1, HEALTHY: 2 };
    if (priority[a.status] !== priority[b.status]) {
      return priority[a.status] - priority[b.status];
    }
    return a.daysRemaining - b.daysRemaining;
  });

  const criticalSkus = finalForecasts.filter((f) => f.status === "CRITICAL");
  const warningSkus = finalForecasts.filter((f) => f.status === "WARNING");
  const healthyCount = finalForecasts.filter((f) => f.status === "HEALTHY").length;

  return {
    forecastHorizonDays: horizon,
    totalSkusEvaluated: finalForecasts.length,
    criticalCount: criticalSkus.length,
    warningCount: warningSkus.length,
    healthyCount,
    totalInventoryValuation: Math.round(totalValuation),
    criticalSkus,
    warningSkus,
    forecasts: finalForecasts,
  };
}

