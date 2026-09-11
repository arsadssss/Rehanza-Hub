import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  getAiClient,
  getAiApiKey,
  getAiBaseUrl,
  getAiModel,
  getAiProvider,
} from "@/lib/ai/client";
import { CRM_AI_TOOLS } from "@/lib/ai/tools";
import { runToolOrchestrator } from "@/lib/ai/tool-orchestrator";
import { getSystemPrompt } from "@/lib/ai/system-prompt";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60; // Allow sufficient time for multi-step tool reasoning

export async function POST(request: Request) {
  try {
    console.log("[AI_CHAT] Request received");

    // 1. Safe Auth Resolution
    let session: any = null;
    try {
      session = await getServerSession(authOptions);
    } catch (authErr: any) {
      console.error(
        "[AI_CHAT_ERROR]",
        JSON.stringify({
          stage: "auth",
          message: authErr?.message || "Session resolution failed",
        })
      );
    }

    const isAuthenticated = Boolean(session?.user);
    const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
    const hasAiApiKey = Boolean(getAiApiKey());
    const aiModel = getAiModel();
    const aiBaseUrl = getAiBaseUrl();
    const aiProvider = getAiProvider();

    console.log(`[AI_CHAT] Authenticated: ${isAuthenticated}`);
    console.log(`[AI_CHAT] DATABASE_URL configured: ${hasDatabaseUrl}`);
    console.log(`[AI_CHAT] AI_API_KEY configured: ${hasAiApiKey}`);
    console.log(`[AI_CHAT] AI_MODEL: ${aiModel}`);
    console.log(`[AI_CHAT] AI_BASE_URL: ${aiBaseUrl}`);
    console.log(`[AI_CHAT] Provider: ${aiProvider}`);

    if (!hasAiApiKey) {
      console.error(
        "[AI_CHAT_ERROR]",
        JSON.stringify({
          stage: "ai_provider",
          message: "AI_API_KEY is not configured in environment",
        })
      );
      return NextResponse.json(
        {
          success: false,
          error: "AI service is currently not configured. Please contact the administrator.",
        },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { message, conversationHistory = [] } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { success: false, error: "Message is required." },
        { status: 400 }
      );
    }

    if (message.length > 3000) {
      return NextResponse.json(
        { success: false, error: "Message exceeds maximum allowed length (3,000 characters)." },
        { status: 400 }
      );
    }

    // 2. Safe Account Isolation & Context Resolution
    const headerAccountId = request.headers.get("x-account-id");
    const cookieHeader = request.headers.get("cookie") || "";
    const cookieMatch = cookieHeader.match(/active_account_id=([^;]+)/);
    const cookieAccountId = cookieMatch ? cookieMatch[1] : null;

    const requestedAccountId =
      headerAccountId ||
      body.accountId ||
      cookieAccountId ||
      session?.user?.accountId;

    let activeAccount: { id: string; name: string } | null = null;

    try {
      if (requestedAccountId) {
        const rows = await sql`
          SELECT id, name 
          FROM accounts 
          WHERE id = ${requestedAccountId} 
          LIMIT 1
        `;
        if (rows.length > 0) {
          activeAccount = { id: rows[0].id, name: rows[0].name };
        }
      }

      if (!activeAccount) {
        const fallbackRows = await sql`
          SELECT id, name 
          FROM accounts 
          ORDER BY CASE WHEN LOWER(name) LIKE '%fashion%' THEN 0 ELSE 1 END, name ASC
          LIMIT 1
        `;
        if (fallbackRows.length > 0) {
          activeAccount = { id: fallbackRows[0].id, name: fallbackRows[0].name };
        } else {
          activeAccount = { id: "1323beea-04db-4d44-a1ca-3ab7a1556f09", name: "Fashion" };
        }
      }
      console.log("[AI_CHAT] Context loaded");
    } catch (dbErr: any) {
      console.error(
        "[AI_CHAT_ERROR]",
        JSON.stringify({
          stage: "database",
          message: dbErr?.message || "Database account lookup failed",
        })
      );
      activeAccount = { id: "1323beea-04db-4d44-a1ca-3ab7a1556f09", name: "Fashion" };
    }

    const targetAccountId = activeAccount.id;
    const targetAccountName = activeAccount.name;

    // 3. Initialize OpenAI Client & Setup Messages
    let client;
    try {
      client = getAiClient();
    } catch (clientErr: any) {
      console.error(
        "[AI_CHAT_ERROR]",
        JSON.stringify({
          stage: "ai_provider",
          message: clientErr?.message || "AI Client initialization failed",
        })
      );
      return NextResponse.json(
        {
          success: false,
          error: "AI service configuration error. Please ensure AI_API_KEY is configured in Vercel.",
        },
        { status: 500 }
      );
    }

    // Sanitize past conversation history (limit to last 10 messages for prompt efficiency)
    const sanitizedHistory: ChatCompletionMessageParam[] = [];
    if (Array.isArray(conversationHistory)) {
      for (const item of conversationHistory.slice(-10)) {
        if (item.role === "user" || item.role === "assistant") {
          sanitizedHistory.push({
            role: item.role,
            content: String(item.content || ""),
          });
        }
      }
    }

    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: getSystemPrompt(targetAccountName),
      },
      ...sanitizedHistory,
      {
        role: "user",
        content: message.trim(),
      },
    ];

    // 4. Autonomous Multi-Turn Tool Orchestrator
    const result = await runToolOrchestrator(
      client,
      aiModel,
      messages,
      CRM_AI_TOOLS,
      targetAccountId,
      4
    );

    console.log("[AI_CHAT] Request completed");

    return NextResponse.json({
      success: true,
      answer: result.answer,
      message: result.answer, // backward-compatibility alias
      sources: result.sources,
      toolsUsed: result.toolsUsed,
      account: {
        id: targetAccountId,
        name: targetAccountName,
      },
    });
  } catch (error: any) {
    console.error(
      "[AI_CHAT_ERROR]",
      JSON.stringify({
        stage: "response",
        message: error?.message || "Unexpected failure in AI chat route",
      })
    );
    return NextResponse.json(
      {
        success: false,
        error: "Sorry, I couldn't retrieve that data right now. Please try again.",
      },
      { status: 500 }
    );
  }
}
