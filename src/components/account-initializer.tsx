"use client";

import { useEffect } from "react";
import { resolveActiveAccount } from "@/lib/account";

export function AccountInitializer() {
  useEffect(() => {
    // Eagerly resolve and verify the active Fashion account across the dashboard shell
    resolveActiveAccount();
  }, []);

  return null;
}
