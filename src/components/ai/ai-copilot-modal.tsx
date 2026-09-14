"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles,
  Send,
  X,
  RotateCcw,
  Bot,
  User,
  AlertCircle,
  TrendingUp,
  Boxes,
  PieChart,
  ShieldAlert,
  ArrowRight,
  Loader2,
  Calendar,
  Layers,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiMarkdownMessage } from "./ai-markdown-message";
import { useAiChat } from "./ai-chat-context";
import { getStoredAccountId } from "@/lib/account";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  toolsUsed?: Array<{ name: string; args: any }>;
  timestamp: string;
}

/**
 * Defensive frontend sanitizer (secondary defense layer).
 * Ensures that no internal DSL or tool tokens can ever be rendered.
 */
function cleanFrontendMessage(text: string): string {
  if (!text || typeof text !== "string") return "";
  let cleaned = text;
  cleaned = cleaned.replace(/<(?:think|thought)>[\s\S]*?<\/(?:think|thought)>/gi, "");
  cleaned = cleaned.replace(/<(?:[|｜]\s*[|｜]\s*DSML\s*[|｜]\s*[|｜]\s*)?invoke[\s\S]*?<\/(?:[|｜]\s*[|｜]\s*DSML\s*[|｜]\s*[|｜]\s*)?invoke>/gi, "");
  cleaned = cleaned.replace(/<(?:[|｜]\s*[|｜]\s*DSML\s*[|｜]\s*[|｜]\s*)?invoke[^>]*\/>/gi, "");
  cleaned = cleaned.replace(/<parameter[\s\S]*?<\/parameter>/gi, "");
  cleaned = cleaned.replace(/<\/?(?:[|｜]\s*[|｜]\s*DSML\s*[|｜]\s*[|｜]\s*)?calls?>/gi, "");
  cleaned = cleaned.replace(/<[|｜]tool calls[|｜]>/gi, "");
  cleaned = cleaned.replace(/<[|｜]tool call:[^>]+>/gi, "");
  cleaned = cleaned.replace(/<[|｜]tool sep[|｜]>/gi, "");
  cleaned = cleaned.replace(/<[|｜]tool call:end[|｜]>/gi, "");
  cleaned = cleaned.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "");
  return cleaned.trim();
}

interface AiCopilotModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  activeAccountId?: string | null;
}

const QUICK_ACTIONS = [
  {
    label: "Business Summary",
    icon: PieChart,
    prompt: "Give me a comprehensive executive business summary including revenue, settlement, net profit/loss, and order volume.",
    color: "from-blue-500/20 to-indigo-500/20 text-blue-300 border-blue-500/30",
  },
  {
    label: "Profit Analysis",
    icon: Wand2,
    prompt: "Perform a detailed profit analysis: what was my net profit or loss last month, and what are the major loss drivers?",
    color: "from-purple-500/20 to-pink-500/20 text-purple-300 border-purple-500/30",
  },
  {
    label: "Inventory Risk",
    icon: ShieldAlert,
    prompt: "What are my immediate inventory risks? Show me products out of stock or approaching critical reorder thresholds.",
    color: "from-amber-500/20 to-orange-500/20 text-amber-300 border-amber-500/30",
  },
  {
    label: "Products to Scale",
    icon: TrendingUp,
    prompt: "Which products should I scale, and which SKUs are ready for increased ad spend?",
    color: "from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/30",
  },
  {
    label: "Returns & RTO",
    icon: Layers,
    prompt: "Show me my returns and RTO breakdown, rates, and which SKUs are causing the highest return losses.",
    color: "from-rose-500/20 to-red-500/20 text-rose-300 border-rose-500/30",
  },
  {
    label: "Payment Analysis",
    icon: Calendar,
    prompt: "Analyze my payment and settlement status: how much did I receive from settlements and payouts?",
    color: "from-indigo-500/20 to-purple-500/20 text-indigo-300 border-indigo-500/30",
  },
  {
    label: "Forecast Demand",
    icon: Boxes,
    prompt: "Forecast my inventory demand for the next 30 days based on recent sales velocity and tell me what to reorder.",
    color: "from-cyan-500/20 to-blue-500/20 text-cyan-300 border-cyan-500/30",
  },
  {
    label: "Stock Forecast",
    icon: ShieldAlert,
    prompt: "Give me a deterministic stock runout forecast: estimated days remaining for each product and upcoming stock warnings.",
    color: "from-teal-500/20 to-emerald-500/20 text-teal-300 border-teal-500/30",
  },
];

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  get_dashboard_summary: "Dashboard KPIs",
  get_business_kpis: "Dashboard KPIs",
  get_financial_summary: "Reconciliation Financials",
  get_reconciliation_financials: "Reconciliation Financials",
  get_order_analytics: "Order Performance",
  get_payment_summary: "Settlements & Payments",
  get_reconciliation_summary: "Reconciliation Breakdown",
  get_sku_analytics: "SKU Unit Economics",
  get_sku_profitability_and_rankings: "SKU Unit Economics",
  get_business_intelligence: "AI Decision Engine",
  get_decision_engine_recommendations: "AI Decision Engine",
  get_inventory_status: "Live Stock Inventory",
  get_inventory_and_stock_risks: "Live Stock Inventory",
  get_low_stock_products: "Low Stock Alerts",
  get_product_performance: "Product Performance",
  get_expense_summary: "Operating Expenses",
  get_vendor_summary: "Vendor Ledgers",
  get_task_summary: "Operational Tasks",
  get_tasks_and_operations: "Operational Tasks",
  get_inventory_forecast: "30-Day Demand Forecast",
  get_inventory_forecast_and_demand: "30-Day Demand Forecast",
  get_upcoming_stock_warnings: "Stock Runout Warnings",
  get_daily_financial_trends: "Daily Trends",
};

export function AiCopilotModal({
  isOpen: propIsOpen,
  onClose: propOnClose,
  activeAccountId,
}: AiCopilotModalProps) {
  const context = useAiChat();
  const isOpen = propIsOpen !== undefined ? propIsOpen : context.isOpen;
  const onClose = propOnClose !== undefined ? propOnClose : context.closeChat;

  const [isMounted, setIsMounted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Keyboard offset state for mobile Safari/Chrome virtual keyboard
  const [keyboardOffset, setKeyboardOffset] = useState<{ bottom: number; height: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, isOpen]);

  // Mobile virtual keyboard detection via visualViewport API
  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;

    const vv = window.visualViewport;
    if (!vv) return;

    const handleViewportChange = () => {
      if (window.innerWidth >= 768) {
        setKeyboardOffset(null);
        return;
      }

      const diff = window.innerHeight - vv.height;
      // If window height shrunk by more than 120px, virtual keyboard is active
      if (diff > 120) {
        const bottomOffset = Math.max(8, window.innerHeight - (vv.offsetTop + vv.height) + 8);
        const availableHeight = Math.max(280, vv.height - 16);
        setKeyboardOffset({ bottom: bottomOffset, height: availableHeight });
      } else {
        setKeyboardOffset(null);
      }
    };

    handleViewportChange();
    vv.addEventListener("resize", handleViewportChange);
    vv.addEventListener("scroll", handleViewportChange);
    window.addEventListener("resize", handleViewportChange);

    return () => {
      vv.removeEventListener("resize", handleViewportChange);
      vv.removeEventListener("scroll", handleViewportChange);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [isOpen]);

  // Lock body scroll on mobile when modal is open
  useEffect(() => {
    if (!isOpen || typeof window === "undefined" || window.innerWidth >= 768) return;

    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [isOpen]);

  // Focus input when opened on desktop
  useEffect(() => {
    if (isOpen && typeof window !== "undefined" && window.innerWidth >= 768) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const target = e.target;
    target.style.height = "auto";
    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
  };

  const handleSendMessage = async (userPrompt: string) => {
    const text = userPrompt.trim();
    if (!text || loading) return;

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    const userMessageId = "msg-" + Date.now();
    const newUserMessage: ChatMessage = {
      id: userMessageId,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setInputValue("");
    setLoading(true);
    setErrorMessage(null);

    try {
      const accountId = activeAccountId || getStoredAccountId() || "1323beea-04db-4d44-a1ca-3ab7a1556f09";

      const historyPayload = updatedMessages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-account-id": accountId,
        },
        body: JSON.stringify({
          message: text,
          conversationHistory: historyPayload,
          accountId,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to receive response from AI Assistant.");
      }

      const resolvedAnswer = json.answer || json.message || "I could not generate an answer based on the available data.";
      const safeContent = cleanFrontendMessage(resolvedAnswer);
      const safeSources = Array.isArray(json.sources) && json.sources.length > 0
        ? json.sources
        : (json.toolsUsed?.map((t: any) => TOOL_DISPLAY_NAMES[t.name] || t.name) || []);

      const assistantMessage: ChatMessage = {
        id: "msg-ai-" + Date.now(),
        role: "assistant",
        content: safeContent,
        sources: Array.from(new Set<string>(safeSources)),
        toolsUsed: json.toolsUsed || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error("AI Chat Error:", err);
      setErrorMessage(err?.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([]);
    setErrorMessage(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  if (!isMounted || !isOpen) return null;

  // Compute inline style override ONLY when mobile keyboard is actively open
  const dynamicKeyboardStyle: React.CSSProperties | undefined = keyboardOffset
    ? {
        bottom: `${keyboardOffset.bottom}px`,
        maxHeight: `${keyboardOffset.height}px`,
        height: `${keyboardOffset.height}px`,
        top: "auto",
      }
    : undefined;

  const modalContent = (
    <>
      {/* Semi-transparent backdrop for mobile viewports */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] md:hidden animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Floating Assistant Window */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Rehanza AI Business Copilot"
        style={dynamicKeyboardStyle}
        className={cn(
          "fixed z-[60] flex flex-col font-body border border-indigo-500/30 bg-slate-950/95 backdrop-blur-2xl shadow-2xl shadow-indigo-950/70 overflow-hidden transition-all duration-200",
          // Mobile: floating cleanly between MobileHeader and MobileBottomNav with safe side margins
          "top-[calc(4rem+env(safe-area-inset-top,0px)+0.5rem)] bottom-[calc(4rem+env(safe-area-inset-bottom,0px)+0.5rem)] left-3 right-3 w-auto rounded-2xl",
          // Desktop (md: >= 768px): fixed right side, below top header, sensible fixed width and max height
          "md:top-20 md:right-8 md:bottom-auto md:left-auto md:w-[480px] md:h-[calc(100dvh-7rem)] md:max-h-[740px] md:rounded-3xl"
        )}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/10 bg-slate-900/80 shrink-0 pt-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20 border border-white/20 shrink-0">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-white font-headline tracking-tight">
                  Rehanza AI
                </h3>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Connected
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={handleResetChat}
                type="button"
                title="Start new conversation"
                aria-label="Start new conversation"
                className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              type="button"
              title="Close Rehanza AI"
              aria-label="Close Rehanza AI"
              className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Conversation Area */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-4 overscroll-contain touch-pan-y scroll-smooth">
          {messages.length === 0 ? (
            /* Welcome State */
            <div className="flex flex-col py-1 space-y-4">
              <div className="text-center space-y-1.5 pt-1">
                <div className="mx-auto h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 flex items-center justify-center shadow-xl shadow-indigo-500/30 border border-white/20">
                  <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <h4 className="text-base font-black text-white font-headline tracking-tight">
                  Hi, I&apos;m Rehanza AI.
                </h4>
                <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed px-2">
                  I can analyze your business, explain your numbers, find risks, forecast inventory and help you decide what to do next.
                </p>
              </div>

              {/* Quick Action Chips */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 px-1">
                  Quick Analysis
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {QUICK_ACTIONS.map((action, idx) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendMessage(action.prompt)}
                        className={cn(
                          "flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all duration-200 group bg-slate-900/40 hover:bg-slate-900/80 hover:border-indigo-400/50 active:scale-[0.98]",
                          action.color
                        )}
                      >
                        <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 shrink-0">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-xs font-bold text-slate-200 group-hover:text-white truncate">
                          {action.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-2.5 sm:p-3 rounded-xl border border-white/5 bg-white/[0.02] text-center">
                <p className="text-[11px] text-slate-400">
                  💡 Answers are generated in real-time from your live reconciliation, inventory, and SKU data.
                </p>
              </div>
            </div>
          ) : (
            /* Active Message List */
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col",
                    msg.role === "user" ? "items-end" : "items-start"
                  )}
                >
                  <div
                    className={cn(
                      "p-3 sm:p-3.5 rounded-2xl text-xs leading-relaxed max-w-[92%] sm:max-w-[85%] break-words",
                      msg.role === "user"
                        ? "bg-gradient-to-br from-indigo-600/40 to-purple-600/30 border border-indigo-500/40 text-slate-100 rounded-tr-sm shadow-md"
                        : "bg-slate-900/75 border border-white/10 text-slate-200 rounded-tl-sm shadow-xl"
                    )}
                  >
                    {/* Source Badges for Assistant */}
                    {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                      <div className="mb-2.5 pb-2 border-b border-white/10 flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 flex items-center gap-1">
                          <Sparkles className="h-2.5 w-2.5" />
                          Source:
                        </span>
                        {msg.sources.map((src, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center text-[10px] font-semibold text-slate-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full"
                          >
                            {src}
                          </span>
                        ))}
                      </div>
                    )}

                    {msg.role === "user" ? (
                      <p className="font-medium text-slate-100 whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <AiMarkdownMessage content={msg.content} />
                    )}
                  </div>

                  <span className="text-[10px] text-slate-500 mt-1 px-1">
                    {msg.timestamp}
                  </span>
                </div>
              ))}

              {/* Loading Thinking State */}
              {loading && (
                <div className="flex items-start gap-2 max-w-[90%]">
                  <div className="h-7 w-7 rounded-lg bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center shrink-0 mt-0.5">
                    <Loader2 className="h-3.5 w-3.5 text-indigo-300 animate-spin" />
                  </div>
                  <div className="p-3 rounded-2xl rounded-tl-sm bg-slate-900/60 border border-white/10 text-xs text-slate-300 shadow-md">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
                      <span className="font-semibold text-indigo-200">
                        Checking your dashboard & analyzing data...
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-200 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Error retrieving response</p>
                    <p className="text-[11px] text-rose-300 mt-0.5">{errorMessage}</p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Composer Footer */}
        <div className="p-2.5 sm:p-3 pb-3 border-t border-white/10 bg-slate-900/80 backdrop-blur-md shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputValue);
            }}
            className="flex items-end gap-2"
          >
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Ask Rehanza AI anything about your business..."
                disabled={loading}
                className="w-full resize-none rounded-xl border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-[16px] md:text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 min-h-[42px] max-h-[120px] leading-snug transition-all"
              />
            </div>
            <Button
              type="submit"
              size="icon"
              disabled={loading || !inputValue.trim()}
              className="h-[42px] w-[42px] rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-600/30 shrink-0 disabled:opacity-40 disabled:pointer-events-none transition-all active:scale-95 flex items-center justify-center"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          <div className="flex justify-between items-center mt-1.5 px-1 text-[10px]">
            <span className="text-slate-500 hidden sm:inline">
              Press Enter to send, Shift+Enter for new line
            </span>
            <span className="text-indigo-400/80 font-medium ml-auto sm:ml-0">
              Live REHANZA-HUB Intelligence
            </span>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
