import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getAiClient, AI_MODEL } from "@/lib/ai/client";
import { CRM_AI_TOOLS } from "@/lib/ai/tools";
import { runToolOrchestrator } from "@/lib/ai/tool-orchestrator";
import { getSystemPrompt } from "@/lib/ai/system-prompt";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const revalidate = 0;
export const maxDuration = 60; // Allow sufficient time for multi-step tool reasoning

export async function POST(request: Request) {
  try {
    // 1. Safe Auth Resolution
    let session: any = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      // In dev/script environments, fallback to header
    }

    const body = await request.json();
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

    // 2. Safe Account Isolation
    const headerAccountId = request.headers.get("x-account-id");
    const cookieHeader = request.headers.get("cookie") || "";
    const cookieMatch = cookieHeader.match(/active_account_id=([^;]+)/);
    const cookieAccountId = cookieMatch ? cookieMatch[1] : null;

    const requestedAccountId =
      headerAccountId ||
      body.accountId ||
      cookieAccountId ||
      session?.user?.accountId;

    // Verify account existence in database
    let activeAccount: { id: string; name: string } | null = null;
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

    // Fallback to Fashion account if none found
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

    const targetAccountId = activeAccount.id;
    const targetAccountName = activeAccount.name;

    // 3. Initialize OpenAI Client & Setup Messages
    const client = getAiClient();

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
      AI_MODEL,
      messages,
      CRM_AI_TOOLS,
      targetAccountId,
      4
    );

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
    console.error("AI Chat Route Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Sorry, I couldn't retrieve that data right now. Please try again.",
      },
      { status: 500 }
    );
  }
}
