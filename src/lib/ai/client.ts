import OpenAI from "openai";

/**
 * Initializes and returns the OpenAI-compatible AI client for Rehanza AI.
 * Uses Xkiro server-side credentials strictly - no keys exposed to the client.
 */
export function getAiClient(): OpenAI {
  const apiKey = process.env.XKIRO_API_KEY;
  if (!apiKey) {
    throw new Error("XKIRO_API_KEY is not configured in server environment.");
  }

  return new OpenAI({
    apiKey,
    baseURL: process.env.XKIRO_BASE_URL || "https://api.xkiro.com/v1",
  });
}

export const AI_MODEL = process.env.XKIRO_MODEL || "deepseek/deepseek-v4-pro";

