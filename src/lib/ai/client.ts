import OpenAI from "openai";

/**
 * Returns the server-configured AI API Key.
 * Checks process.env.AI_API_KEY first (Vercel production standard),
 * with backward-compatible fallback to process.env.XKIRO_API_KEY.
 */
export function getAiApiKey(): string | undefined {
  return process.env.AI_API_KEY || process.env.XKIRO_API_KEY;
}

/**
 * Returns the server-configured AI Base URL.
 * Checks process.env.AI_BASE_URL first, with fallback to XKIRO_BASE_URL or default.
 */
export function getAiBaseUrl(): string {
  return process.env.AI_BASE_URL || process.env.XKIRO_BASE_URL || "https://api.xkiro.com/v1";
}

/**
 * Returns the server-configured AI Model.
 * Checks process.env.AI_MODEL first, with fallback to XKIRO_MODEL or default.
 */
export function getAiModel(): string {
  return process.env.AI_MODEL || process.env.XKIRO_MODEL || "openai/gpt-5.3-codex-spark";
}

/**
 * Returns the server-configured AI Provider name.
 */
export function getAiProvider(): string {
  return process.env.AI_PROVIDER || "xkiro";
}

/**
 * Initializes and returns the OpenAI-compatible AI client for Rehanza AI.
 * Uses server-side credentials strictly - no keys exposed to the client.
 */
export function getAiClient(): OpenAI {
  const apiKey = getAiApiKey();
  if (!apiKey) {
    throw new Error("AI_API_KEY is not configured in server environment.");
  }

  return new OpenAI({
    apiKey,
    baseURL: getAiBaseUrl(),
  });
}

export const AI_MODEL = process.env.AI_MODEL || process.env.XKIRO_MODEL || "openai/gpt-5.3-codex-spark";


