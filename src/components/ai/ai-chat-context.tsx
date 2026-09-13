"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface AiChatContextType {
  isOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
}

const AiChatContext = createContext<AiChatContextType | undefined>(undefined);

export function AiChatProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openChat = useCallback(() => setIsOpen(true), []);
  const closeChat = useCallback(() => setIsOpen(false), []);
  const toggleChat = useCallback(() => setIsOpen((prev) => !prev), []);

  // Global keyboard shortcuts:
  // - Escape: closes the chat if open
  // - Cmd+K or Ctrl+K: toggles the chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        // Prevent default search behavior if pressing Cmd+K
        const activeElement = document.activeElement;
        const isInputField =
          activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement;
        if (!isInputField) {
          e.preventDefault();
          setIsOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <AiChatContext.Provider value={{ isOpen, openChat, closeChat, toggleChat }}>
      {children}
    </AiChatContext.Provider>
  );
}

export function useAiChat() {
  const context = useContext(AiChatContext);
  if (!context) {
    throw new Error("useAiChat must be used within an AiChatProvider");
  }
  return context;
}

