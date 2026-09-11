import type { ChatCompletionTool } from "openai/resources/chat/completions";

/**
 * Controlled Server-Side Tool Definitions for REHANZA-HUB AI Business Copilot.
 * Defined strictly according to Section 9, 10, 11, 12, 13 of user requirements.
 */
export const CRM_AI_TOOLS: ChatCompletionTool[] = [
  // 1. Dashboard
  {
    type: "function",
    function: {
      name: "get_dashboard_summary",
      description: "Returns relevant executive dashboard KPIs for the active account: gross sales volume, inventory value, pending tasks, net cash flow, and latest reconciliation headline metrics.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },

  // 2. Financials
  {
    type: "function",
    function: {
      name: "get_financial_summary",
      description: "Returns audited financial metrics matching Meesho workbook parity (revenue, settlement, net profit/loss, orders, AOV, shipping, returns, RTO, TCS, TDS, claims, recovery fees, ads cost). Reuses calculateReconciliationFinancials.",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "Start date YYYY-MM-DD (e.g. '2026-08-01'). Defaults to last month." },
          endDate: { type: "string", description: "End date YYYY-MM-DD (e.g. '2026-08-31'). Defaults to last month." },
        },
        required: [],
      },
    },
  },

  // 3. Orders
  {
    type: "function",
    function: {
      name: "get_order_analytics",
      description: "Query order performance breakdown across canonical statuses (Delivered, Shipped, Exchange, Customer Return, RTO, Cancelled), order volume, units, and SKU-level order counts.",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "Start date YYYY-MM-DD" },
          endDate: { type: "string", description: "End date YYYY-MM-DD" },
          status: { type: "string", description: "Optional status filter (e.g. 'Delivered', 'Customer Return', 'RTO', 'Cancelled')" },
          sku: { type: "string", description: "Optional specific SKU code to filter by" },
        },
        required: [],
      },
    },
  },

  // 4. Payments
  {
    type: "function",
    function: {
      name: "get_payment_summary",
      description: "Returns platform settlements, total received payouts, bank realization totals, and payment status trends. Respects account isolation.",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "Start date YYYY-MM-DD" },
          endDate: { type: "string", description: "End date YYYY-MM-DD" },
        },
        required: [],
      },
    },
  },

  // 5. Reconciliation
  {
    type: "function",
    function: {
      name: "get_reconciliation_summary",
      description: "Returns canonical reconciliation status breakdown (delivered, shipped, exchange, return, RTO, cancel, net orders, bank settlement, final profit/loss, deductions). Reuses reconciliation source of truth.",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "Start date YYYY-MM-DD (e.g. '2026-08-01')" },
          endDate: { type: "string", description: "End date YYYY-MM-DD (e.g. '2026-08-31')" },
        },
        required: [],
      },
    },
  },

  // 6. SKU Analytics
  {
    type: "function",
    function: {
      name: "get_sku_analytics",
      description: "Returns SKU unit economics: top revenue SKU, top profit SKU, worst profit SKU, orders, quantity, revenue, settlement, profit, margin, return rate, RTO rate, and cost status. Reuses calculateSkuAnalytics.",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "Start date YYYY-MM-DD" },
          endDate: { type: "string", description: "End date YYYY-MM-DD" },
          limit: { type: "number", description: "Number of top/bottom SKUs (default: 10)" },
          sku: { type: "string", description: "Optional specific SKU to query" },
        },
        required: [],
      },
    },
  },

  // 7. Decision Engine
  {
    type: "function",
    function: {
      name: "get_business_intelligence",
      description: "Returns AI Decision Engine analysis: top scaling opportunity, highest business risk SKU, most profitable SKU, largest loss driver, decisions (SCALE, MONITOR, REVIEW, STOP), risk scores, and prioritized action lists. Reuses generateDecisionEngineRecommendations.",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "Start date YYYY-MM-DD" },
          endDate: { type: "string", description: "End date YYYY-MM-DD" },
        },
        required: [],
      },
    },
  },

  // 8. Inventory Status
  {
    type: "function",
    function: {
      name: "get_inventory_status",
      description: "Returns current stock levels, SKUs, product names, reorder thresholds, stock valuation, and stock health status for the active account.",
      parameters: {
        type: "object",
        properties: {
          sku: { type: "string", description: "Optional specific SKU to check" },
          status: { type: "string", enum: ["all", "low_stock", "out_of_stock", "healthy"] },
        },
        required: [],
      },
    },
  },

  // 9. Low Stock
  {
    type: "function",
    function: {
      name: "get_low_stock_products",
      description: "Returns products and SKUs approaching or below their designated reorder thresholds, requiring inventory replenishment.",
      parameters: {
        type: "object",
        properties: {
          thresholdOverride: { type: "number", description: "Optional threshold override (default: 15)" },
        },
        required: [],
      },
    },
  },

  // 10. Product Performance
  {
    type: "function",
    function: {
      name: "get_product_performance",
      description: "Returns sales, profit, return rates, and order counts per product for business performance analysis.",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "Start date YYYY-MM-DD" },
          endDate: { type: "string", description: "End date YYYY-MM-DD" },
        },
        required: [],
      },
    },
  },

  // 11. Expenses
  {
    type: "function",
    function: {
      name: "get_expense_summary",
      description: "Returns total operating expenses categorized by department/type (ads, logistics, software, packaging, office) and expense trends.",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "Start date YYYY-MM-DD" },
          endDate: { type: "string", description: "End date YYYY-MM-DD" },
        },
        required: [],
      },
    },
  },

  // 12. Vendors
  {
    type: "function",
    function: {
      name: "get_vendor_summary",
      description: "Returns vendor purchase ledgers, total purchase volume per supplier, outstanding payables, and product cost supplies.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },

  // 13. Tasks
  {
    type: "function",
    function: {
      name: "get_task_summary",
      description: "Returns operational task tracking status: active pending tasks, completed tasks, completion rate, and operational workflow health.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },

  // 14. Deterministic Inventory Forecasting
  {
    type: "function",
    function: {
      name: "get_inventory_forecast",
      description: "Calculates deterministic 30-60 day inventory demand projections, average daily sales velocity, estimated runout days remaining, demand ranges, and recommended reorder quantities based on actual sales history.",
      parameters: {
        type: "object",
        properties: {
          forecastDays: { type: "number", description: "Days to project forward (default: 30)" },
          targetSku: { type: "string", description: "Optional specific SKU to forecast" },
        },
        required: [],
      },
    },
  },

  // 15. Upcoming Stock Warnings
  {
    type: "function",
    function: {
      name: "get_upcoming_stock_warnings",
      description: "Identifies upcoming stock risks categorized as CRITICAL (runout <10 days or out of stock), WARNING (approaching threshold or <25 days), and HEALTHY, providing recommended PO reorder actions.",
      parameters: {
        type: "object",
        properties: {
          level: { type: "string", enum: ["all", "CRITICAL", "WARNING"], description: "Filter warning severity" },
        },
        required: [],
      },
    },
  },

  // Backward-compatible aliases
  {
    type: "function",
    function: {
      name: "get_business_kpis",
      description: "Alias for get_dashboard_summary.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_reconciliation_financials",
      description: "Alias for get_financial_summary.",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string" },
          endDate: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sku_profitability_and_rankings",
      description: "Alias for get_sku_analytics.",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string" },
          endDate: { type: "string" },
          limit: { type: "number" },
          sku: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_decision_engine_recommendations",
      description: "Alias for get_business_intelligence.",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string" },
          endDate: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_inventory_and_stock_risks",
      description: "Alias for get_inventory_status.",
      parameters: {
        type: "object",
        properties: {
          lowStockThreshold: { type: "number" },
          status: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_inventory_forecast_and_demand",
      description: "Alias for get_inventory_forecast.",
      parameters: {
        type: "object",
        properties: {
          forecastDays: { type: "number" },
        },
        required: [],
      },
    },
  },
];
