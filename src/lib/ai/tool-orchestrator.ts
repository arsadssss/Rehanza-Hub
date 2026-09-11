import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import OpenAI from "openai";
import { executeCrmTool } from "./tool-executor";

/**
 * Strict allowlist of permitted tools.
 * Arbitrary tool names supplied by the model will be safely rejected.
 */
export const ALLOWED_CRM_TOOLS = new Set([
  "get_dashboard_summary",
  "get_business_kpis",
  "get_financial_summary",
  "get_reconciliation_financials",
  "get_order_analytics",
  "get_payment_summary",
  "get_reconciliation_summary",
  "get_sku_analytics",
  "get_sku_profitability_and_rankings",
  "get_business_intelligence",
  "get_decision_engine_recommendations",
  "get_inventory_status",
  "get_inventory_and_stock_risks",
  "get_low_stock_products",
  "get_product_performance",
  "get_expense_summary",
  "get_vendor_summary",
  "get_task_summary",
  "get_tasks_and_operations",
  "get_inventory_forecast",
  "get_inventory_forecast_and_demand",
  "get_upcoming_stock_warnings",
  "get_daily_financial_trends",
]);

/**
 * Human-readable names for sources presented to the user.
 */
export const TOOL_HUMAN_SOURCES: Record<string, string> = {
  get_dashboard_summary: "Dashboard KPIs",
  get_business_kpis: "Dashboard KPIs",
  get_financial_summary: "Reconciliation Financials",
  get_reconciliation_financials: "Reconciliation Financials",
  get_order_analytics: "Order Analytics",
  get_payment_summary: "Payment & Settlement Records",
  get_reconciliation_summary: "Reconciliation Summary",
  get_sku_analytics: "SKU Unit Economics",
  get_sku_profitability_and_rankings: "SKU Unit Economics",
  get_business_intelligence: "Decision Engine",
  get_decision_engine_recommendations: "Decision Engine",
  get_inventory_status: "Inventory Status",
  get_inventory_and_stock_risks: "Inventory Status",
  get_low_stock_products: "Low Stock Inventory",
  get_product_performance: "Product Performance",
  get_expense_summary: "Operating Expenses",
  get_vendor_summary: "Vendor Ledgers",
  get_task_summary: "Operational Tasks",
  get_tasks_and_operations: "Operational Tasks",
  get_inventory_forecast: "Demand Forecast",
  get_inventory_forecast_and_demand: "Demand Forecast",
  get_upcoming_stock_warnings: "Stock Runout Warnings",
  get_daily_financial_trends: "Daily Trends",
};

export interface NormalizedToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
  isTextual: boolean;
}

/**
 * Parses tool calls from raw assistant text content.
 * Supports:
 * 1. DSML syntax: <| | DSML | | calls><| | DSML | | invoke name="...">...</invoke>
 * 2. XML syntax: <invoke name="...">...</invoke> or <invoke name="..." />
 * 3. DeepSeek Unicode: <｜tool calls｜><｜tool call:begin｜>function<｜tool sep｜>name...
 * 4. JSON blocks: <tool_call>{"name": "...", "arguments": {...}}</tool_call>
 */
export function parseToolCallsFromContent(content: string): Array<{ name: string; args: Record<string, any> }> {
  if (!content || typeof content !== "string") return [];
  const results: Array<{ name: string; args: Record<string, any> }> = [];

  // 1. DSML & Standard XML Invoke blocks: <invoke name="..."> or <| | DSML | | invoke name="...">
  const invokeRegex = /<(?:[|｜]\s*[|｜]\s*DSML\s*[|｜]\s*[|｜]\s*)?invoke\s+name=["'']([^"'']+)["''](?:\s*\/>|>([\s\S]*?)<\/(?:[|｜]\s*[|｜]\s*DSML\s*[|｜]\s*[|｜]\s*)?invoke>)/gi;
  let match: RegExpExecArray | null;

  while ((match = invokeRegex.exec(content)) !== null) {
    const rawName = match[1]?.trim();
    const body = match[2]?.trim() || "";
    const args: Record<string, any> = {};

    if (body) {
      // Parse <parameter name="...">value</parameter>
      const paramRegex = /<parameter\s+name=["'']([^"'']+)["'']>([\s\S]*?)<\/parameter>/gi;
      let pMatch: RegExpExecArray | null;
      let foundParam = false;
      while ((pMatch = paramRegex.exec(body)) !== null) {
        foundParam = true;
        const pName = pMatch[1]?.trim();
        const pVal = pMatch[2]?.trim();
        try {
          args[pName] = JSON.parse(pVal);
        } catch {
          args[pName] = pVal;
        }
      }

      // If no <parameter> tags, test for raw JSON in the invoke body
      if (!foundParam) {
        try {
          const jsonParsed = JSON.parse(body);
          if (typeof jsonParsed === "object" && jsonParsed !== null) {
            Object.assign(args, jsonParsed);
          }
        } catch {}
      }
    }

    if (rawName) {
      results.push({ name: rawName, args });
    }
  }

  // 2. <tool_call> ... </tool_call> blocks
  const toolCallTagRegex = /<tool_call>([\s\S]*?)<\/tool_call>/gi;
  let tcMatch: RegExpExecArray | null;
  while ((tcMatch = toolCallTagRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(tcMatch[1].trim());
      if (parsed.name) {
        results.push({
          name: parsed.name,
          args: typeof parsed.arguments === "object" ? parsed.arguments : (JSON.parse(parsed.arguments || "{}")),
        });
      }
    } catch {}
  }

  // 3. DeepSeek Unicode special tokens: <｜tool call:begin｜>function<｜tool sep｜>name
  const deepSeekSpecialRegex = /<[|｜]tool call:begin[|｜]>(?:function<[|｜]tool sep[|｜]>)?([a-zA-Z0-9_-]+)(?:[\r\n\s]*```(?:json)?\s*([\s\S]*?)\s*```)?[\s\S]*?(?:<[|｜]tool call:end[|｜]>|$)/gi;
  let dsMatch: RegExpExecArray | null;
  while ((dsMatch = deepSeekSpecialRegex.exec(content)) !== null) {
    const rawName = dsMatch[1]?.trim();
    let args: Record<string, any> = {};
    if (dsMatch[2]) {
      try {
        args = JSON.parse(dsMatch[2].trim());
      } catch {}
    }
    if (rawName) {
      results.push({ name: rawName, args });
    }
  }

  return results;
}

/**
 * Sanitizes assistant responses to ensure NO internal tool calls, XML, DSML,
 * thinking tags (<think>, <thought>), or DSL tokens ever reach the user.
 */
export function sanitizeAssistantResponse(text: string): string {
  if (!text || typeof text !== "string") return "";

  let cleaned = text;

  // 1. Remove reasoning / thought blocks
  cleaned = cleaned.replace(/<(?:think|thought)>[\s\S]*?<\/(?:think|thought)>/gi, "");

  // 2. Remove invoke blocks (with or without DSML prefix)
  cleaned = cleaned.replace(/<(?:[|｜]\s*[|｜]\s*DSML\s*[|｜]\s*[|｜]\s*)?invoke[\s\S]*?<\/(?:[|｜]\s*[|｜]\s*DSML\s*[|｜]\s*[|｜]\s*)?invoke>/gi, "");
  cleaned = cleaned.replace(/<(?:[|｜]\s*[|｜]\s*DSML\s*[|｜]\s*[|｜]\s*)?invoke[^>]*\/>/gi, "");

  // 3. Remove parameter tags
  cleaned = cleaned.replace(/<parameter[\s\S]*?<\/parameter>/gi, "");

  // 4. Remove opening/closing call wrappers (e.g. <| | DSML | | calls>)
  cleaned = cleaned.replace(/<\/?(?:[|｜]\s*[|｜]\s*DSML\s*[|｜]\s*[|｜]\s*)?calls?>/gi, "");

  // 5. Remove DeepSeek unicode tool markers
  cleaned = cleaned.replace(/<[|｜]tool calls[|｜]>/gi, "");
  cleaned = cleaned.replace(/<[|｜]tool call:[^>]+>/gi, "");
  cleaned = cleaned.replace(/<[|｜]tool sep[|｜]>/gi, "");
  cleaned = cleaned.replace(/<[|｜]tool call:end[|｜]>/gi, "");

  // 6. Remove <tool_call>...</tool_call>
  cleaned = cleaned.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "");

  return cleaned.trim();
}

export interface OrchestratorResult {
  answer: string;
  sources: string[];
  toolsUsed: Array<{ name: string; args: any }>;
}

/**
 * Executes an autonomous, multi-turn AI tool-calling loop.
 * Detects both native OpenAI tool_calls and textual DSML/XML tool invocations.
 * Guarantees zero leakage of internal tool markup to the user.
 */
export async function runToolOrchestrator(
  client: OpenAI,
  model: string,
  messages: ChatCompletionMessageParam[],
  tools: ChatCompletionTool[],
  accountId: string,
  maxTurns: number = 4
): Promise<OrchestratorResult> {
  let turn = 0;
  let finalAnswer = "";
  const toolsExecuted: Array<{ name: string; args: any }> = [];
  const sourcesSet = new Set<string>();

  while (turn < maxTurns) {
    turn++;

    const completion = await client.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.2,
    });

    const assistantMessage = completion.choices[0]?.message;
    if (!assistantMessage) {
      throw new Error("No response returned from AI provider.");
    }

    // Collect all tool calls (native and textual)
    const detectedCalls: NormalizedToolCall[] = [];

    // Check native tool calls
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      for (const tc of assistantMessage.tool_calls) {
        if (tc.type === "function") {
          let args = {};
          try {
            args = JSON.parse(tc.function.arguments || "{}");
          } catch {
            args = {};
          }
          detectedCalls.push({
            id: tc.id,
            name: tc.function.name,
            args,
            isTextual: false,
          });
        }
      }
    }

    // Check textual tool calls in content
    const textualCalls = parseToolCallsFromContent(assistantMessage.content || "");
    for (const tc of textualCalls) {
      detectedCalls.push({
        id: `call_textual_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: tc.name,
        args: tc.args,
        isTextual: true,
      });
    }

    // If tool calls were detected, execute them server-side
    if (detectedCalls.length > 0) {
      // Append formatted assistant message with tool_calls for API schema compliance
      messages.push({
        role: "assistant",
        content: null,
        tool_calls: detectedCalls.map((c) => ({
          id: c.id,
          type: "function" as const,
          function: {
            name: c.name,
            arguments: JSON.stringify(c.args),
          },
        })),
      });

      for (const call of detectedCalls) {
        toolsExecuted.push({ name: call.name, args: call.args });

        // Security check: validate against allowlist
        if (!ALLOWED_CRM_TOOLS.has(call.name)) {
          console.warn(`[AI Security] Rejected disallowed tool: ${call.name}`);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              error: `Tool "${call.name}" is not permitted or unknown.`,
            }),
          });
          continue;
        }

        const sourceLabel = TOOL_HUMAN_SOURCES[call.name] || "CRM Live Data";
        sourcesSet.add(sourceLabel);

        try {
          const result = await executeCrmTool(call.name, call.args, accountId);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        } catch (toolErr: any) {
          console.error(`[AI Tool Error] Failed executing ${call.name}:`, toolErr);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              error: `Failed to retrieve data for ${call.name}. Please proceed with available context.`,
            }),
          });
        }
      }
    } else {
      // No tool calls requested: assistant has provided the natural language response
      finalAnswer = sanitizeAssistantResponse(assistantMessage.content || "");
      break;
    }
  }

  // Fallback: If loop reached max turns without a final textual answer, force synthesis
  if (!finalAnswer && turn >= maxTurns) {
    const finalCompletion = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.2,
    });
    finalAnswer = sanitizeAssistantResponse(finalCompletion.choices[0]?.message?.content || "");
  }

  // If answer is still empty or failed to sanitize, provide a safe fallback
  if (!finalAnswer) {
    finalAnswer = "I analyzed your business data, but could not format the final summary. Please try asking again.";
  }

  return {
    answer: finalAnswer,
    sources: Array.from(sourcesSet),
    toolsUsed: toolsExecuted,
  };
}

