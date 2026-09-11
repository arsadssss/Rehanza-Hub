import "dotenv/config";
import { getAiClient, AI_MODEL } from "./client";
import { executeCrmTool } from "./tool-executor";
import { calculateInventoryForecast } from "./inventory-forecast";
import { resolveAiAccountContext } from "./context";
import { CRM_AI_TOOLS } from "./tools";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, actual?: any, expected?: any) {
  if (condition) {
    console.log(`✓ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`✗ FAIL: ${testName} -> Actual: ${JSON.stringify(actual)}, Expected: ${JSON.stringify(expected)}`);
    failedCount++;
  }
}

async function runAiTests() {
  console.log("========================================================================");
  console.log("REHANZA-HUB AI BUSINESS COPILOT TEST SUITE");
  console.log("========================================================================\n");

  const fashionAccountId = "1323beea-04db-4d44-a1ca-3ab7a1556f09";
  const cosmeticsAccountId = "e5839188-7241-4664-b8d6-ca209f3883ea";

  // TEST 1: AI Client Initialization
  try {
    const client = getAiClient();
    assert(client !== null && typeof client.chat === "object", "1. AI client initializes with valid configuration");
  } catch (e: any) {
    assert(false, "1. AI client initializes with valid configuration", e.message);
  }

  // TEST 2: Missing API Key Error Handling
  try {
    const originalKey = process.env.XKIRO_API_KEY;
    delete process.env.XKIRO_API_KEY;
    let caught = false;
    try {
      getAiClient();
    } catch {
      caught = true;
    }
    process.env.XKIRO_API_KEY = originalKey;
    assert(caught, "2. Missing API key throws safe configuration error without exposing secrets");
  } catch (e: any) {
    assert(false, "2. Missing API key error handling", e.message);
  }

  // TEST 3: Tools Catalog Definition
  assert(CRM_AI_TOOLS.length >= 15, "3. All required AI tools defined in tools catalog", CRM_AI_TOOLS.length, ">= 15");
  const toolNames = CRM_AI_TOOLS.map((t) => (t as any).function?.name);
  assert(toolNames.includes("get_financial_summary"), "3a. Tools include get_financial_summary");
  assert(toolNames.includes("get_sku_analytics"), "3b. Tools include get_sku_analytics");
  assert(toolNames.includes("get_business_intelligence"), "3c. Tools include get_business_intelligence");
  assert(toolNames.includes("get_inventory_forecast"), "3d. Tools include get_inventory_forecast");
  assert(toolNames.includes("get_upcoming_stock_warnings"), "3e. Tools include get_upcoming_stock_warnings");

  // TEST 4: Account Context Resolution & Isolation
  const contextFashion = await resolveAiAccountContext(fashionAccountId);
  assert(contextFashion.accountId === fashionAccountId, "4a. Fashion account resolves correctly", contextFashion.accountId, fashionAccountId);
  assert(contextFashion.lastMonthRange.startDate === "2026-08-01", "4b. Temporal anchor resolves August 2026 start", contextFashion.lastMonthRange.startDate, "2026-08-01");
  assert(contextFashion.lastMonthRange.endDate === "2026-08-31", "4c. Temporal anchor resolves August 2026 end", contextFashion.lastMonthRange.endDate, "2026-08-31");

  // TEST 5: Financial Summary Tool Execution (Parity Check)
  const fin = await executeCrmTool("get_financial_summary", { startDate: "2026-08-01", endDate: "2026-08-31" }, fashionAccountId);
  assert(fin.orders.total === 561, "5a. Financial summary returns 561 total orders", fin.orders.total, 561);
  assert(fin.orders.delivered === 192, "5b. Financial summary returns 192 delivered orders", fin.orders.delivered, 192);
  assert(fin.orders.returns === 99, "5c. Financial summary returns 99 customer returns", fin.orders.returns, 99);
  assert(fin.orders.rto === 128, "5d. Financial summary returns 128 RTO orders", fin.orders.rto, 128);
  assert(fin.orders.cancelled === 106, "5e. Financial summary returns 106 cancelled orders", fin.orders.cancelled, 106);
  assert(fin.orders.netOrders === 291, "5f. Financial summary returns 291 net orders", fin.orders.netOrders, 291);
  assert(fin.settlement === 36838.45, "5g. Financial summary returns ₹36,838.45 bank settlement", fin.settlement, 36838.45);
  assert(fin.netProfitOrLoss === -67628.19, "5h. Financial summary returns -₹67,628.19 net loss", fin.netProfitOrLoss, -67628.19);
  assert(fin.isNetProfit === false, "5i. Financial summary correctly flags loss as isNetProfit: false", fin.isNetProfit, false);

  // TEST 6: SKU Analytics Tool Execution
  const skus = await executeCrmTool("get_sku_analytics", { startDate: "2026-08-01", endDate: "2026-08-31", limit: 5 }, fashionAccountId);
  assert(skus.totalSkusTracked === 28, "6a. SKU analytics tracks 28 SKUs for August", skus.totalSkusTracked, 28);
  assert(skus.rankings?.topProfitSku?.sku === "PNK-MJB-01", "6b. Top profit SKU is PNK-MJB-01", skus.rankings?.topProfitSku?.sku, "PNK-MJB-01");
  assert(skus.rankings?.worstProfitSku?.sku === "G-PNK-MJB-01", "6c. Worst profit SKU (loss driver) is G-PNK-MJB-01", skus.rankings?.worstProfitSku?.sku, "G-PNK-MJB-01");

  // TEST 7: Decision Engine Tool Execution
  const decisions = await executeCrmTool("get_business_intelligence", { startDate: "2026-08-01", endDate: "2026-08-31" }, fashionAccountId);
  assert(decisions.topScalingOpportunity?.sku === "PK-MJB-1", "7a. Best opportunity identified as PK-MJB-1", decisions.topScalingOpportunity?.sku, "PK-MJB-1");
  assert(decisions.highestBusinessRisk?.sku === "Purple-Mjb-01", "7b. Highest business risk identified as Purple-Mjb-01", decisions.highestBusinessRisk?.sku, "Purple-Mjb-01");
  assert(Array.isArray(decisions.priorityActions), "7c. Priority actions array generated", true);

  // TEST 8: Deterministic Inventory & Demand Forecasting
  const forecast = await calculateInventoryForecast(fashionAccountId, { forecastDays: 30 });
  assert(forecast.totalSkusEvaluated === 78, "8a. Inventory forecast evaluates all 78 variants", forecast.totalSkusEvaluated, 78);
  assert(forecast.criticalCount >= 1, "8b. Deterministic forecast identifies critical stockout risks", forecast.criticalCount >= 1, true);
  assert(typeof forecast.totalInventoryValuation === "number", "8c. Total inventory valuation is computed as number", typeof forecast.totalInventoryValuation, "number");

  const sampleCritical = forecast.criticalSkus[0];
  if (sampleCritical) {
    assert(sampleCritical.status === "CRITICAL", "8d. Critical SKU has CRITICAL status", sampleCritical.status, "CRITICAL");
    assert(sampleCritical.recommendedReorderQty >= 0, "8e. Recommended reorder qty is non-negative", sampleCritical.recommendedReorderQty >= 0, true);
    assert(typeof sampleCritical.recommendedAction === "string" && sampleCritical.recommendedAction.length > 0, "8f. Recommended action is populated with actionable text", true);
  }

  // TEST 9: Upcoming Stock Warnings Tool
  const warnings = await executeCrmTool("get_upcoming_stock_warnings", {}, fashionAccountId);
  assert(warnings.totalWarnings >= 1, "9a. Stock warnings returns upcoming stock risks", warnings.totalWarnings >= 1, true);
  assert(Array.isArray(warnings.stockRisks), "9b. Stock risks is an array of warning items", true);

  // TEST 10: Account Isolation Verification
  const cosmeticsFin = await executeCrmTool("get_financial_summary", { startDate: "2026-08-01", endDate: "2026-08-31" }, cosmeticsAccountId);
  assert(cosmeticsFin.orders.total === 0, "10a. Cosmetics account orders isolated from Fashion (0 orders)", cosmeticsFin.orders.total, 0);
  assert(cosmeticsFin.settlement === 0, "10b. Cosmetics account settlement isolated from Fashion (0 settlement)", cosmeticsFin.settlement, 0);

  // TEST 11: Error Handling for Unknown Tool
  let unknownToolError = false;
  try {
    await executeCrmTool("invalid_unknown_tool_name", {}, fashionAccountId);
  } catch {
    unknownToolError = true;
  }
  assert(unknownToolError, "11. Unknown tool rejected gracefully with informative error");

  // TEST 12: Cost-Pending SKU Detection
  const singlePendingSku = await executeCrmTool("get_sku_analytics", { sku: "Purple-Mjb-01" }, fashionAccountId);
  assert(singlePendingSku.found === true, "12a. Purple-Mjb-01 found in SKU analytics", true);
  assert(singlePendingSku.sku?.costStatus === "pending", "12b. Unconfigured SKU correctly reports costStatus: 'pending'", singlePendingSku.sku?.costStatus, "pending");

  console.log("\n========================================================================");
  console.log(`TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("========================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAiTests().catch((err) => {
  console.error("Test Suite Fatal Error:", err);
  process.exit(1);
});

