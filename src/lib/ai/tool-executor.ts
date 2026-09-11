import { sql } from "@/lib/db";
import { calculateReconciliationFinancials } from "@/lib/reconciliation/financial-calculator";
import { calculateSkuAnalytics } from "@/lib/reconciliation/sku-analytics-calculator";
import { generateDecisionEngineRecommendations } from "@/lib/reconciliation/decision-engine";
import { ReconciliationDateFilter } from "@/lib/reconciliation/types";
import { calculateInventoryForecast } from "./inventory-forecast";
import { getLastMonthRange } from "./context";

/**
 * Executes a controlled CRM tool server-side, strictly scoped to the active accountId.
 * Guarantees zero database leakage between accounts (Fashion vs Cosmetics).
 */
export async function executeCrmTool(
  name: string,
  args: any = {},
  accountId: string
): Promise<any> {
  const defaultDates = getLastMonthRange();
  const isValidDate = (d: any) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.trim());
  const startDate = isValidDate(args.startDate) ? args.startDate.trim() : defaultDates.startDate;
  const endDate = isValidDate(args.endDate) ? args.endDate.trim() : defaultDates.endDate;

  switch (name) {
    // 1. Dashboard
    case "get_dashboard_summary":
    case "get_business_kpis": {
      const [orderRes, returnRes, inventoryRes, taskRes, payoutRes, expenseRes] = await Promise.all([
        sql`
          SELECT 
            COUNT(id)::int as total_orders,
            COALESCE(SUM(quantity), 0)::int as total_units,
            COALESCE(SUM(total_amount), 0)::numeric as gross_revenue
          FROM orders 
          WHERE account_id = ${accountId} AND is_deleted = false
        `,
        sql`
          SELECT 
            COALESCE(SUM(quantity), 0)::int as return_units,
            COALESCE(SUM(total_loss), 0)::numeric as return_loss
          FROM returns 
          WHERE account_id = ${accountId} AND is_deleted = false
        `,
        sql`
          SELECT COALESCE(SUM(quantity * cost_per_unit), 0)::numeric as inventory_value
          FROM vendor_purchases
          WHERE account_id = ${accountId} AND is_deleted = false
        `,
        sql`
          SELECT 
            COUNT(id)::int as total_tasks,
            COUNT(id) FILTER (WHERE status = 'Completed')::int as completed_tasks,
            COUNT(id) FILTER (WHERE status != 'Completed')::int as active_tasks
          FROM tasks
          WHERE is_deleted = false AND (task_group = 'Fashion' OR task_group IS NULL)
        `,
        sql`
          SELECT COALESCE(SUM(amount), 0)::numeric as total
          FROM platform_payouts
          WHERE account_id = ${accountId} AND is_deleted = false
        `,
        sql`
          SELECT COALESCE(SUM(amount), 0)::numeric as total
          FROM business_expenses
          WHERE is_deleted = false
        `,
      ]);

      const totalPaymentReceived = Number(payoutRes[0]?.total || 0);
      const totalBusinessExpenses = Number(expenseRes[0]?.total || 0);
      const netCashFlow = totalPaymentReceived - totalBusinessExpenses;

      const reconFin = await calculateReconciliationFinancials(accountId, {
        startDate: defaultDates.startDate,
        endDate: defaultDates.endDate,
      });

      return {
        source: "Dashboard KPIs",
        account_id: accountId,
        netCashFlow: Math.round(netCashFlow * 100) / 100,
        netCashFlowFormatted: `₹${Math.round(netCashFlow).toLocaleString("en-IN")}`,
        totalPaymentReceived,
        totalBusinessExpenses,
        grossRevenue: Number(orderRes[0]?.gross_revenue || 0),
        totalOrders: Number(orderRes[0]?.total_orders || 0),
        totalOrderUnits: Number(orderRes[0]?.total_units || 0),
        inventoryValuation: Number(inventoryRes[0]?.inventory_value || 0),
        activePendingTasks: Number(taskRes[0]?.active_tasks || 0),
        completedTasks: Number(taskRes[0]?.completed_tasks || 0),
        reconciledPeriod: defaultDates.label,
        reconciledSettlementAmount: reconFin.settlementAmount,
        reconciledNetProfitOrLoss: reconFin.finalPayoutNetProfit,
        reconciledTotalOrders: reconFin.orders.totalOrders,
        reconciledDeliveredOrders: reconFin.orders.deliveredOrders,
      };
    }

    // 2. Financials
    case "get_financial_summary":
    case "get_reconciliation_financials": {
      const filter: ReconciliationDateFilter = { startDate, endDate };
      const fin = await calculateReconciliationFinancials(accountId, filter);

      return {
        period: { startDate, endDate },
        revenue: fin.totalSalesInvoice,
        settlement: fin.settlementAmount,
        netProfitOrLoss: fin.finalPayoutNetProfit,
        isNetProfit: fin.finalPayoutNetProfit >= 0,
        averageOrderValue: fin.averageOrderValue,
        orders: {
          total: fin.orders.totalOrders,
          delivered: fin.orders.deliveredOrders,
          deliveredRate: `${fin.orders.deliveredRate}%`,
          shipped: fin.orders.shippedOrders,
          shippedRate: `${fin.orders.shippedRate}%`,
          exchange: fin.orders.exchangeOrders,
          returns: fin.orders.returnOrders,
          returnRate: `${fin.orders.returnRate}%`,
          rto: fin.orders.rtoOrders,
          rtoRate: `${fin.orders.rtoRate}%`,
          cancelled: fin.orders.cancelOrders,
          cancelRate: `${fin.orders.cancelRate}%`,
          netOrders: fin.orders.netOrders,
        },
        deductions: {
          purchaseCost: fin.costs.purchaseCost,
          packagingCost: fin.costs.packagingCost,
          shippingCost: fin.costs.shippingCost,
          returnShippingCost: fin.costs.returnShippingCost,
          tcs: fin.costs.tcs,
          tds: fin.costs.tds,
          meeshoCommission: fin.costs.meeshoCommission,
          fixedFee: fin.costs.fixedFee,
          warehousingFee: fin.costs.warehousingFee,
          recoveryFees: fin.costs.recoveryFees,
          claims: fin.costs.claims,
          adsCost: fin.costs.adsCost,
        },
      };
    }

    // 3. Orders
    case "get_order_analytics": {
      if (args.sku) {
        const skuData = await calculateSkuAnalytics(accountId, { startDate, endDate });
        const target = (skuData.skus || []).find(
          (s) => s.sku.toLowerCase() === String(args.sku).toLowerCase()
        );
        if (target) {
          return {
            period: { startDate, endDate },
            sku: target.sku,
            productName: target.productName,
            totalOrders: target.totalOrders,
            breakdown: {
              delivered: target.deliveredOrders,
              deliveredRate: `${target.deliveredRate}%`,
              customerReturns: target.returnOrders,
              returnRate: `${target.returnRate}%`,
              rto: target.rtoOrders,
              rtoRate: `${target.rtoRate}%`,
              cancelled: target.cancelOrders,
              cancelRate: `${target.cancelRate}%`,
            },
            revenue: target.revenue,
            profit: target.profit,
          };
        }
      }

      const fin = await calculateReconciliationFinancials(accountId, { startDate, endDate });
      return {
        period: { startDate, endDate },
        skuFilter: args.sku || "all",
        totalOrders: fin.orders.totalOrders,
        breakdown: [
          { status: "Delivered", units: fin.orders.deliveredOrders, rate: `${fin.orders.deliveredRate}%` },
          { status: "Shipped", units: fin.orders.shippedOrders, rate: `${fin.orders.shippedRate}%` },
          { status: "Exchange", units: fin.orders.exchangeOrders, rate: `${fin.orders.exchangeRate}%` },
          { status: "Customer Return", units: fin.orders.returnOrders, rate: `${fin.orders.returnRate}%` },
          { status: "RTO", units: fin.orders.rtoOrders, rate: `${fin.orders.rtoRate}%` },
          { status: "Cancelled", units: fin.orders.cancelOrders, rate: `${fin.orders.cancelRate}%` },
        ],
        netRealizedOrders: fin.orders.netOrders,
      };
    }

    // 4. Payments
    case "get_payment_summary": {
      const [payoutsRes, rawPaymentsRes, allTimePayoutsRes] = await Promise.all([
        sql`
          SELECT 
            COALESCE(SUM(amount), 0)::numeric as total_payouts,
            COUNT(id)::int as payout_count
          FROM platform_payouts
          WHERE account_id = ${accountId}
            AND is_deleted = false
            AND payout_date >= ${startDate}::date
            AND payout_date <= ${endDate}::date
        `,
        sql`
          SELECT 
            COALESCE(SUM(final_settlement_amount), 0)::numeric as bank_settlement,
            COUNT(id)::int as tx_count
          FROM reconciliation_payments_raw
          WHERE account_id = ${accountId}
            AND payment_date >= ${startDate}::date
            AND payment_date <= ${endDate}::date
        `,
        sql`
          SELECT 
            COALESCE(SUM(amount), 0)::numeric as total_payouts,
            COUNT(id)::int as payout_count
          FROM platform_payouts
          WHERE account_id = ${accountId}
            AND is_deleted = false
        `,
      ]);

      const fin = await calculateReconciliationFinancials(accountId, { startDate, endDate });

      return {
        period: { startDate, endDate },
        realizedBankSettlement: fin.settlementAmount,
        recordedPayoutsTotalForPeriod: Number(payoutsRes[0]?.total_payouts || 0),
        payoutTransactionsCountForPeriod: Number(payoutsRes[0]?.payout_count || 0),
        rawPaymentRecordsCountForPeriod: Number(rawPaymentsRes[0]?.tx_count || 0),
        settlementStatus: fin.settlementAmount > 0 ? "RECEIVED" : "PENDING_OR_ZERO",
        allTimeRecordedPayoutsTotal: Number(allTimePayoutsRes[0]?.total_payouts || 0),
        allTimePayoutTransactionsCount: Number(allTimePayoutsRes[0]?.payout_count || 0),
      };
    }

    // 5. Reconciliation
    case "get_reconciliation_summary": {
      const fin = await calculateReconciliationFinancials(accountId, { startDate, endDate });
      return {
        period: { startDate, endDate },
        orders: {
          delivered: fin.orders.deliveredOrders,
          shipped: fin.orders.shippedOrders,
          exchange: fin.orders.exchangeOrders,
          return: fin.orders.returnOrders,
          rto: fin.orders.rtoOrders,
          cancel: fin.orders.cancelOrders,
          netOrders: fin.orders.netOrders,
          totalOrders: fin.orders.totalOrders,
        },
        rates: {
          deliveredRate: `${fin.orders.deliveredRate}%`,
          customerReturnRate: `${fin.orders.returnRate}%`,
          rtoRate: `${fin.orders.rtoRate}%`,
          cancelRate: `${fin.orders.cancelRate}%`,
        },
        financials: {
          settlementAmount: fin.settlementAmount,
          finalProfit: fin.finalPayoutNetProfit,
          invoiceTotal: fin.totalSalesInvoice,
        },
        deductionsSummary: fin.costs,
      };
    }

    // 6. SKU Analytics
    case "get_sku_analytics":
    case "get_sku_profitability_and_rankings": {
      const limit = Number(args.limit || 10);
      const skuData = await calculateSkuAnalytics(accountId, { startDate, endDate });

      if (args.sku) {
        const target = (skuData.skus || []).find(
          (s) => s.sku.toLowerCase() === String(args.sku).toLowerCase()
        );
        return {
          period: { startDate, endDate },
          found: !!target,
          sku: target || null,
        };
      }

      const sortedByProfit = [...(skuData.skus || [])].sort((a, b) => b.profit - a.profit);
      const sortedByRevenue = [...(skuData.skus || [])].sort((a, b) => b.revenue - a.revenue);

      return {
        period: { startDate, endDate },
        totalSkusTracked: skuData.skus?.length || 0,
        rankings: skuData.rankings,
        topRevenueSkus: sortedByRevenue.slice(0, limit).map((s) => ({
          sku: s.sku,
          productName: s.productName,
          revenue: s.revenue,
          orders: s.totalOrders,
          profit: s.profit,
        })),
        topProfitableSkus: sortedByProfit.slice(0, limit).map((s) => ({
          sku: s.sku,
          productName: s.productName,
          profit: s.profit,
          margin: `${s.profitMargin}%`,
          orders: s.totalOrders,
          delivered: s.deliveredOrders,
          costStatus: s.costStatus,
        })),
        largestLossDrivers: [...sortedByProfit].reverse().slice(0, limit).map((s) => ({
          sku: s.sku,
          productName: s.productName,
          profit: s.profit,
          margin: `${s.profitMargin}%`,
          orders: s.totalOrders,
          returns: s.returnOrders,
          returnRate: `${s.returnRate}%`,
          rto: s.rtoOrders,
          rtoRate: `${s.rtoRate}%`,
          costStatus: s.costStatus,
        })),
        lossConcentration: skuData.lossConcentration,
      };
    }

    // 7. Decision Engine
    case "get_business_intelligence":
    case "get_decision_engine_recommendations": {
      const decisionData = await generateDecisionEngineRecommendations(accountId, { startDate, endDate });

      return {
        period: { startDate, endDate },
        summary: decisionData.summary,
        topScalingOpportunity: decisionData.summary?.bestOpportunity,
        highestBusinessRisk: decisionData.summary?.highestRiskSku,
        mostProfitableSku: decisionData.summary?.mostProfitableSku,
        largestLossDriver: decisionData.summary?.largestLossSku,
        priorityActions: decisionData.priorityActions,
        evaluatedDecisions: (decisionData.decisions || []).slice(0, 8).map((d) => ({
          sku: d.sku,
          productName: d.productName,
          decision: d.decision,
          confidence: d.confidence,
          riskScore: d.riskScore,
          opportunityScore: d.opportunityScore,
          primaryReason: d.primaryReason,
          action: d.action,
        })),
      };
    }

    // 8. Inventory Status
    case "get_inventory_status":
    case "get_inventory_and_stock_risks": {
      const forecast = await calculateInventoryForecast(accountId, {
        targetSku: args.sku,
      });

      let items = forecast.forecasts;
      if (args.status === "low_stock") {
        items = items.filter((i) => i.status === "WARNING" || i.status === "CRITICAL");
      } else if (args.status === "out_of_stock") {
        items = items.filter((i) => i.currentStock <= 0);
      } else if (args.status === "healthy") {
        items = items.filter((i) => i.status === "HEALTHY");
      }

      return {
        totalSkus: forecast.totalSkusEvaluated,
        totalInventoryValuation: forecast.totalInventoryValuation,
        summary: {
          criticalCount: forecast.criticalCount,
          warningCount: forecast.warningCount,
          healthyCount: forecast.healthyCount,
        },
        items: items.slice(0, 20).map((i) => ({
          sku: i.sku,
          productName: i.productName,
          currentStock: i.currentStock,
          reorderThreshold: i.reorderThreshold,
          costPrice: i.costPrice,
          daysRemaining: i.daysRemaining === 999 ? "Ample (>90d)" : `${i.daysRemaining} days`,
          status: i.status,
          recommendedAction: i.recommendedAction,
        })),
      };
    }

    // 9. Low Stock Products
    case "get_low_stock_products": {
      const forecast = await calculateInventoryForecast(accountId, {
        thresholdOverride: args.thresholdOverride,
      });

      const lowStockItems = forecast.forecasts.filter(
        (f) => f.status === "CRITICAL" || f.status === "WARNING"
      );

      return {
        totalLowStockCount: lowStockItems.length,
        criticalCount: forecast.criticalCount,
        warningCount: forecast.warningCount,
        productsToReorder: lowStockItems.map((i) => ({
          sku: i.sku,
          productName: i.productName,
          currentStock: i.currentStock,
          reorderThreshold: i.reorderThreshold,
          daysRemaining: `${i.daysRemaining} days`,
          dailySalesVelocity: i.dailySalesVelocity,
          recommendedReorderQuantity: i.recommendedReorderQty,
          status: i.status,
          recommendedAction: i.recommendedAction,
        })),
      };
    }

    // 10. Product Performance
    case "get_product_performance": {
      const skuData = await calculateSkuAnalytics(accountId, { startDate, endDate });

      // Group by product name
      const productMap = new Map<string, any>();
      (skuData.skus || []).forEach((s) => {
        const name = s.productName || s.sku;
        const cur = productMap.get(name) || {
          productName: name,
          skus: [],
          totalOrders: 0,
          deliveredOrders: 0,
          returnOrders: 0,
          rtoOrders: 0,
          revenue: 0,
          profit: 0,
        };
        cur.skus.push(s.sku);
        cur.totalOrders += s.totalOrders;
        cur.deliveredOrders += s.deliveredOrders;
        cur.returnOrders += s.returnOrders;
        cur.rtoOrders += s.rtoOrders;
        cur.revenue += s.revenue;
        cur.profit += s.profit;
        productMap.set(name, cur);
      });

      const productList = Array.from(productMap.values()).sort((a, b) => b.profit - a.profit);

      return {
        period: { startDate, endDate },
        totalProductsTracked: productList.length,
        topProductsByProfit: productList.slice(0, 10).map((p) => ({
          productName: p.productName,
          skus: p.skus,
          totalOrders: p.totalOrders,
          deliveredRate: p.totalOrders > 0 ? `${Math.round((p.deliveredOrders / p.totalOrders) * 100)}%` : "0%",
          returnRate: p.totalOrders > 0 ? `${Math.round((p.returnOrders / p.totalOrders) * 100)}%` : "0%",
          profit: p.profit,
          revenue: p.revenue,
        })),
      };
    }

    // 11. Expenses
    case "get_expense_summary": {
      const expenseCategories = await sql`
        SELECT 
          COALESCE(description, 'General') as category,
          COALESCE(SUM(amount), 0)::numeric as total_amount,
          COUNT(id)::int as count
        FROM business_expenses
        WHERE is_deleted = false
        GROUP BY description
        ORDER BY total_amount DESC
      `;

      const totalAmount = expenseCategories.reduce((sum: number, e: any) => sum + Number(e.total_amount || 0), 0);

      return {
        period: { startDate, endDate },
        totalOperatingExpenses: totalAmount,
        breakdownByCategory: expenseCategories.map((e: any) => ({
          category: e.category,
          amount: Number(e.total_amount),
          percentage: totalAmount > 0 ? `${Math.round((Number(e.total_amount) / totalAmount) * 100)}%` : "0%",
          count: e.count,
        })),
      };
    }

    // 12. Vendors
    case "get_vendor_summary": {
      const vendorList = await sql`
        SELECT 
          v.id,
          v.vendor_name,
          COALESCE(SUM(vp.total_amount), 0)::numeric as total_purchases,
          COUNT(vp.id)::int as purchase_records
        FROM vendors v
        LEFT JOIN vendor_purchases vp ON v.id = vp.vendor_id AND vp.is_deleted = false
        WHERE v.account_id = ${accountId}
        GROUP BY v.id, v.vendor_name
        ORDER BY total_purchases DESC
        LIMIT 10
      `;

      return {
        totalVendors: vendorList.length,
        topVendors: vendorList.map((v: any) => ({
          vendorName: v.vendor_name,
          totalPurchases: Number(v.total_purchases),
          purchasesCount: v.purchase_records,
        })),
      };
    }

    // 13. Tasks
    case "get_task_summary":
    case "get_tasks_and_operations": {
      const tasksRes = await sql`
        SELECT 
          status,
          COUNT(id)::int as count
        FROM tasks
        WHERE is_deleted = false
        GROUP BY status
      `;

      const totalTasks = tasksRes.reduce((sum: number, t: any) => sum + t.count, 0);
      const completed = tasksRes.find((t: any) => t.status === "Completed")?.count || 0;
      const pending = tasksRes.find((t: any) => t.status === "Pending")?.count || 0;
      const inProgress = tasksRes.find((t: any) => t.status === "In Progress")?.count || 0;

      return {
        totalTasks,
        completedTasks: completed,
        pendingTasks: pending,
        inProgressTasks: inProgress,
        completionRate: totalTasks > 0 ? `${Math.round((completed / totalTasks) * 100)}%` : "0%",
      };
    }

    // 14. Deterministic Inventory Forecasting
    case "get_inventory_forecast":
    case "get_inventory_forecast_and_demand": {
      const forecastDays = Math.max(7, Math.min(90, Number(args.forecastDays || 30)));
      const forecast = await calculateInventoryForecast(accountId, {
        forecastDays,
        targetSku: args.targetSku,
      });

      return {
        forecastPeriodDays: forecastDays,
        totalSkusEvaluated: forecast.totalSkusEvaluated,
        criticalStockoutRiskCount: forecast.criticalCount,
        warningReorderCount: forecast.warningCount,
        criticalAlerts: forecast.criticalSkus.slice(0, 10),
        demandProjections: forecast.forecasts.slice(0, 15).map((f) => ({
          sku: f.sku,
          productName: f.productName,
          currentStock: f.currentStock,
          dailySalesVelocity: f.dailySalesVelocity,
          estimatedDaysRemaining: f.daysRemaining === 999 ? ">90 days" : `${f.daysRemaining} days`,
          trendDirection: f.trendDirection,
          projectedDemandRange: `${f.demandRange.min} - ${f.demandRange.max} units`,
          recommendedReorderQty: f.recommendedReorderQty,
          status: f.status,
          confidence: f.confidence,
          recommendedAction: f.recommendedAction,
        })),
      };
    }

    // 15. Upcoming Stock Warnings
    case "get_upcoming_stock_warnings": {
      const forecast = await calculateInventoryForecast(accountId);
      const level = args.level || "all";

      let warningItems = [...forecast.criticalSkus, ...forecast.warningSkus];
      if (level === "CRITICAL") warningItems = forecast.criticalSkus;
      else if (level === "WARNING") warningItems = forecast.warningSkus;

      return {
        totalWarnings: warningItems.length,
        criticalCount: forecast.criticalCount,
        warningCount: forecast.warningCount,
        healthyCount: forecast.healthyCount,
        stockRisks: warningItems.map((i) => ({
          sku: i.sku,
          productName: i.productName,
          currentStock: i.currentStock,
          dailySalesVelocity: i.dailySalesVelocity,
          estimatedDaysRemaining: `${i.daysRemaining} days`,
          status: i.status,
          recommendedReorderQty: i.recommendedReorderQty,
          action: i.recommendedAction,
        })),
      };
    }

    // 16. Daily Financial Trends (Supporting Trend Time-Series)
    case "get_daily_financial_trends": {
      const skuData = await calculateSkuAnalytics(accountId, { startDate, endDate });
      const trends = skuData.dailyTrends || [];

      return {
        period: { startDate, endDate },
        totalActiveDays: trends.length,
        aggregates: {
          totalRevenue: trends.reduce((sum, d) => sum + d.revenue, 0),
          totalSettlement: trends.reduce((sum, d) => sum + d.settlement, 0),
          totalProfit: trends.reduce((sum, d) => sum + d.profit, 0),
        },
        dailyTrends: trends.map((d) => ({
          date: d.date,
          orders: d.orders,
          revenue: d.revenue,
          settlement: d.settlement,
          profit: d.profit,
          delivered: d.delivered,
          returns: d.returns,
          rto: d.rto,
        })),
      };
    }

    default:
      throw new Error(`Unknown CRM AI tool: ${name}`);
  }
}
