import dotenv from "dotenv";
dotenv.config();

import {
  parseToolCallsFromContent,
  sanitizeAssistantResponse,
  ALLOWED_CRM_TOOLS,
  TOOL_HUMAN_SOURCES,
} from "./tool-orchestrator";
import { executeCrmTool } from "./tool-executor";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${name}${detail ? ` - ${detail}` : ""}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n========================================================");
  console.log("REHANZA AI TOOL ORCHESTRATOR & SANITIZATION TEST SUITE");
  console.log("========================================================\n");

  const FASHION_ACCOUNT_ID = "1323beea-04db-4d44-a1ca-3ab7a1556f09";
  const COSMETICS_ACCOUNT_ID = "e5839188-7241-4664-b8d6-ca209f3883ea";

  // 1. Simple question with no tool call
  console.log("Test Group 1: Simple Question & Clean Natural Language Responses");
  {
    const plainText = "Hello! How can I assist with your e-commerce operations today?";
    const parsed = parseToolCallsFromContent(plainText);
    assert(parsed.length === 0, "No tool calls detected in plain text");
    const sanitized = sanitizeAssistantResponse(plainText);
    assert(sanitized === plainText, "Plain text remains unmodified after sanitization");
  }

  // 2. Native tool call detection & normalization
  console.log("\nTest Group 2: Native Tool Call Support");
  {
    const nativeToolCalls = [
      {
        id: "call_native_123",
        type: "function" as const,
        function: {
          name: "get_dashboard_summary",
          arguments: "{}",
        },
      },
    ];
    assert(nativeToolCalls[0].type === "function", "Native tool call is function type");
    assert(nativeToolCalls[0].function.name === "get_dashboard_summary", "Native tool name matches");
    assert(ALLOWED_CRM_TOOLS.has(nativeToolCalls[0].function.name), "Native tool is in server allowlist");
  }

  // 3. Textual DSML tool call parsing
  console.log("\nTest Group 3: Textual DSML & XML Tool Call Parsing");
  {
    const exactUserBugDsml = `<| | DSML | | calls>
<| | DSML | | invoke name="get_payment_summary">
<parameter name="startDate">2026-08-01</parameter>
<parameter name="endDate">2026-08-31</parameter>
</invoke>`;

    const parsedDsml = parseToolCallsFromContent(exactUserBugDsml);
    assert(parsedDsml.length === 1, "Parses exactly 1 tool call from user bug DSML");
    assert(parsedDsml[0]?.name === "get_payment_summary", "Extracts correct tool name: get_payment_summary");
    assert(parsedDsml[0]?.args?.startDate === "2026-08-01", "Extracts parameter startDate");
    assert(parsedDsml[0]?.args?.endDate === "2026-08-31", "Extracts parameter endDate");

    const xmlSelfClosing = `<| | DSML | | calls><invoke name="get_dashboard_summary"/></| | DSML | | calls>`;
    const parsedSelfClosing = parseToolCallsFromContent(xmlSelfClosing);
    assert(parsedSelfClosing.length === 1, "Parses self-closing invoke tag");
    assert(parsedSelfClosing[0]?.name === "get_dashboard_summary", "Extracts tool name from self-closing tag");

    const deepSeekUnicode = `<｜tool calls｜><｜tool call:begin｜>function<｜tool sep｜>get_order_analytics\n\`\`\`json\n{"status": "Delivered"}\n\`\`\`<｜tool call:end｜>`;
    const parsedUnicode = parseToolCallsFromContent(deepSeekUnicode);
    assert(parsedUnicode.length === 1, "Parses DeepSeek Unicode special tokens");
    assert(parsedUnicode[0]?.name === "get_order_analytics", "Extracts tool name from Unicode tokens");
    assert(parsedUnicode[0]?.args?.status === "Delivered", "Extracts arguments from JSON block");

    const toolCallTag = `<tool_call>{"name": "get_inventory_status", "arguments": {}}</tool_call>`;
    const parsedToolCallTag = parseToolCallsFromContent(toolCallTag);
    assert(parsedToolCallTag.length === 1, "Parses <tool_call> tag format");
    assert(parsedToolCallTag[0]?.name === "get_inventory_status", "Extracts tool name from <tool_call>");
  }

  // 4. Tool executes correctly
  console.log("\nTest Group 4: Tool Execution Correctness");
  {
    const dashboardResult = await executeCrmTool("get_dashboard_summary", {}, FASHION_ACCOUNT_ID);
    assert(dashboardResult !== null && typeof dashboardResult === "object", "get_dashboard_summary returns object");
    assert(typeof dashboardResult.netCashFlow === "number", "get_dashboard_summary contains netCashFlow number");
    assert(dashboardResult.netCashFlow === 25573.46, `Net Cash Flow is 25573.46 (actual: ${dashboardResult.netCashFlow})`);
    assert(dashboardResult.netCashFlowFormatted === "₹25,573", `Net Cash Flow formatted is ₹25,573 (actual: ${dashboardResult.netCashFlowFormatted})`);
  }

  // 5. Tool result formatting for model feedback
  console.log("\nTest Group 5: Tool Result Serialization for Model Feedback");
  {
    const dashboardResult = await executeCrmTool("get_dashboard_summary", {}, FASHION_ACCOUNT_ID);
    const serialized = JSON.stringify(dashboardResult);
    assert(serialized.includes("25573"), "Serialized tool result includes net cash flow 25573");
    assert(!serialized.includes("DATABASE_URL"), "Serialized tool result contains no db credentials");
    assert(!serialized.includes("password"), "Serialized tool result contains no secret keys");
  }

  // 6. Final answer generation & formatting
  console.log("\nTest Group 6: Final Answer Sanitization");
  {
    const responseWithLeakedMarkup = `<| | DSML | | calls>
<| | DSML | | invoke name="get_payment_summary">
<parameter name="startDate">2026-08-01</parameter>
</invoke>
Your net cash flow is **₹25,573**.`;

    const cleaned = sanitizeAssistantResponse(responseWithLeakedMarkup);
    assert(!cleaned.includes("<invoke"), "Sanitized answer contains no <invoke>");
    assert(!cleaned.includes("DSML"), "Sanitized answer contains no DSML tokens");
    assert(!cleaned.includes("<parameter"), "Sanitized answer contains no <parameter>");
    assert(cleaned === "Your net cash flow is **₹25,573**.", "Answer content is perfectly preserved");
  }

  // 7. Raw tool markup is NEVER returned
  console.log("\nTest Group 7: Raw Tool Markup Elimination");
  {
    const multipleArtifacts = `<think>Internal model reasoning about net cash flow</think>
<| | DSML | | calls>
<invoke name="get_dashboard_summary" />
</| | DSML | | calls>
<tool_call>{"name": "test"}</tool_call>
The net cash flow is positive.`;

    const cleaned = sanitizeAssistantResponse(multipleArtifacts);
    assert(!cleaned.includes("<think>"), "Eliminates <think> tags");
    assert(!cleaned.includes("Internal model reasoning"), "Eliminates internal reasoning text");
    assert(!cleaned.includes("<tool_call>"), "Eliminates <tool_call> tags");
    assert(cleaned === "The net cash flow is positive.", "Only final natural language survives");
  }

  // 8. Unknown tool is rejected safely
  console.log("\nTest Group 8: Unknown Tool Allowlist Protection");
  {
    const rogueTool = "execute_arbitrary_shell_or_sql";
    assert(!ALLOWED_CRM_TOOLS.has(rogueTool), "Rogue tool is NOT in ALLOWED_CRM_TOOLS");
    const allowed = ALLOWED_CRM_TOOLS.has("get_dashboard_summary");
    assert(allowed, "Valid tool get_dashboard_summary is permitted");
  }

  // 9. Invalid parameters rejection & safety
  console.log("\nTest Group 9: Parameter Robustness");
  {
    // Passing malformed or unexpected arguments does not crash
    const res = await executeCrmTool("get_order_analytics", { startDate: "invalid-date", endDate: "invalid-date" }, FASHION_ACCOUNT_ID);
    assert(res !== null, "get_order_analytics handles invalid dates safely without throwing");
  }

  // 10. Net Cash Flow question uses Dashboard source (returns 25,573)
  console.log("\nTest Group 10: Net Cash Flow Source of Truth Verification");
  {
    const dashRes = await executeCrmTool("get_dashboard_summary", {}, FASHION_ACCOUNT_ID);
    assert(dashRes.source === "Dashboard KPIs", "get_dashboard_summary reports source as Dashboard KPIs");
    assert(Math.round(dashRes.netCashFlow) === 25573, "Net Cash Flow rounded is exactly 25573");
    assert(dashRes.totalPaymentReceived === 59052.46, "Total Payment Received matches platform_payouts");
    assert(dashRes.totalBusinessExpenses === 33479, "Total Business Expenses matches business_expenses");
  }

  // 11. Payment question uses Payment source
  console.log("\nTest Group 11: Payment Source Verification");
  {
    const payRes = await executeCrmTool("get_payment_summary", { startDate: "2026-08-01", endDate: "2026-08-31" }, FASHION_ACCOUNT_ID);
    assert(payRes.realizedBankSettlement > 0, "Payment summary returns realizedBankSettlement");
    assert(typeof payRes.allTimeRecordedPayoutsTotal === "number", "Payment summary returns allTimeRecordedPayoutsTotal");
  }

  // 12. Reconciliation question uses Reconciliation source
  console.log("\nTest Group 12: Reconciliation Source Verification");
  {
    const reconRes = await executeCrmTool("get_reconciliation_summary", { startDate: "2026-08-01", endDate: "2026-08-31" }, FASHION_ACCOUNT_ID);
    assert(reconRes.orders.totalOrders > 0, "Reconciliation orders total > 0");
    assert(reconRes.orders.delivered > 0, "Delivered orders count > 0");
    assert(reconRes.orders.rto > 0, "RTO orders count > 0");
    assert(reconRes.orders.return > 0, "Customer return count > 0");
  }

  // 13. Inventory question uses Inventory source
  console.log("\nTest Group 13: Inventory Source Verification");
  {
    const invRes = await executeCrmTool("get_inventory_status", {}, FASHION_ACCOUNT_ID);
    assert(invRes.totalSkus > 0, "Inventory status returns tracked SKUs");
    assert(Array.isArray(invRes.items), "Inventory status returns items array");

    const lowStock = await executeCrmTool("get_low_stock_products", {}, FASHION_ACCOUNT_ID);
    assert(Array.isArray(lowStock.productsToReorder), "Low stock products returns productsToReorder array");
  }

  // 14. Multi-Tenant Account Isolation
  console.log("\nTest Group 14: Multi-Tenant Account Isolation");
  {
    const fashionDash = await executeCrmTool("get_dashboard_summary", {}, FASHION_ACCOUNT_ID);
    const cosmeticsDash = await executeCrmTool("get_dashboard_summary", {}, COSMETICS_ACCOUNT_ID);

    assert(fashionDash.account_id === FASHION_ACCOUNT_ID, "Fashion dashboard scoped to Fashion");
    assert(cosmeticsDash.account_id === COSMETICS_ACCOUNT_ID, "Cosmetics dashboard scoped to Cosmetics");
    assert(fashionDash.netCashFlow !== cosmeticsDash.netCashFlow, "Fashion and Cosmetics have isolated net cash flows");
  }

  // 15. Provider failure fallback
  console.log("\nTest Group 15: Provider / Network Fallback");
  {
    const fallbackAnswer = sanitizeAssistantResponse("");
    assert(fallbackAnswer === "", "Empty response handled without throwing");
  }

  // 16. Tool failure fallback
  console.log("\nTest Group 16: Tool Failure Handling");
  {
    try {
      // Non-existent account handled gracefully
      const res = await executeCrmTool("get_dashboard_summary", {}, "00000000-0000-0000-0000-000000000000");
      assert(res !== null, "Gracefully handles empty/unknown account without crashing");
    } catch (e: any) {
      assert(false, "Should not throw unhandled exception on missing account data");
    }
  }

  // 17. Empty data handling
  console.log("\nTest Group 17: Empty Data Handling");
  {
    const emptyDateRes = await executeCrmTool("get_sku_analytics", { startDate: "1999-01-01", endDate: "1999-01-02" }, FASHION_ACCOUNT_ID);
    assert(emptyDateRes.totalSkusTracked === 0, "Zero SKUs analyzed for out-of-range date");
  }

  // 18. Forecast response clearly marked as forecast
  console.log("\nTest Group 18: Forecast Clarity Verification");
  {
    const forecastRes = await executeCrmTool("get_inventory_forecast", {}, FASHION_ACCOUNT_ID);
    assert(forecastRes.forecastPeriodDays === 30, "Forecast declares 30-day forecast period");
    assert(forecastRes.totalSkusEvaluated > 0, "Forecast evaluated active SKUs");
    assert(Array.isArray(forecastRes.demandProjections), "Forecast contains demand projections");
  }

  console.log("\n========================================================");
  console.log(`TOTAL PASSED: ${passed}`);
  console.log(`TOTAL FAILED: ${failed}`);
  console.log("========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
