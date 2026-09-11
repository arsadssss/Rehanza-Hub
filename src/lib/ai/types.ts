/**
 * TypeScript Interfaces for REHANZA-HUB AI Business Copilot.
 */

export type StockAlertLevel = "CRITICAL" | "WARNING" | "HEALTHY";

export interface SkuInventoryForecast {
  sku: string;
  productName: string;
  currentStock: number;
  reorderThreshold: number;
  costPrice: number;
  totalUnitsSold30d: number;
  dailySalesVelocity: number; // units sold / day
  daysRemaining: number; // currentStock / dailySalesVelocity
  status: StockAlertLevel;
  trendDirection: "UPWARD" | "STABLE" | "DOWNWARD";
  projected30DayDemand: number;
  projected60DayDemand: number;
  demandRange: { min: number; max: number };
  recommendedReorderQty: number;
  recommendedAction: string;
  confidence: "Low" | "Medium" | "High";
}

export interface InventoryForecastSummary {
  forecastHorizonDays: number;
  totalSkusEvaluated: number;
  criticalCount: number;
  warningCount: number;
  healthyCount: number;
  totalInventoryValuation: number;
  criticalSkus: SkuInventoryForecast[];
  warningSkus: SkuInventoryForecast[];
  forecasts: SkuInventoryForecast[];
}

export interface AiAccountContext {
  accountId: string;
  accountName: string;
  currentDate: string;
  lastMonthRange: {
    startDate: string;
    endDate: string;
    label: string;
  };
}

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  toolsUsed?: Array<{ name: string; args: any }>;
  timestamp?: string;
}

export interface AiChatRequest {
  message: string;
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  accountId?: string;
}

export interface AiChatResponse {
  success: boolean;
  message?: string;
  toolsUsed?: Array<{ name: string; args: any }>;
  account?: {
    id: string;
    name: string;
  };
  error?: string;
}

