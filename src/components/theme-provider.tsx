"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

export type Theme = "classic" | "blue" | "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isBlueTheme: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id || session?.user?.email;
  const [theme, setThemeState] = useState<Theme>("classic");

  // Initial load from localStorage
  useEffect(() => {
    try {
      const userKey = userId ? `rehanza-theme-${userId}` : null;
      const savedTheme = (
        (userKey && localStorage.getItem(userKey)) ||
        localStorage.getItem("rehanza-theme") ||
        localStorage.getItem("app-theme")
      ) as Theme | null;

      if (savedTheme === "blue" || savedTheme === "classic" || savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") {
        setThemeState(savedTheme);
      } else {
        setThemeState("classic");
      }
    } catch {
      setThemeState("classic");
    }
  }, [userId]);

  // If user logs in and has a specific theme in DB preferences, load it
  useEffect(() => {
    if (userId) {
      const userKey = `rehanza-theme-${userId}`;
      const localUserTheme = localStorage.getItem(userKey);
      if (!localUserTheme) {
        fetch("/api/settings")
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.preferences?.theme) {
              setThemeState(data.preferences.theme);
            }
          })
          .catch(() => {});
      }
    }
  }, [userId]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem("rehanza-theme", newTheme);
      localStorage.setItem("app-theme", newTheme);
      if (userId) {
        localStorage.setItem(`rehanza-theme-${userId}`, newTheme);
      }
    } catch {
      // ignore
    }
  }, [userId]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("theme-blue", "theme-classic", "light", "dark");

    if (theme === "blue") {
      root.classList.add("theme-blue");
      root.style.colorScheme = "light";
    } else if (theme === "classic") {
      root.classList.add("theme-classic", "dark");
      root.style.colorScheme = "dark";
    } else if (theme === "light") {
      root.classList.add("light");
      root.style.colorScheme = "light";
    } else if (theme === "dark") {
      root.classList.add("theme-classic", "dark");
      root.style.colorScheme = "dark";
    } else if (theme === "system") {
      const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (isSystemDark) {
        root.classList.add("theme-classic", "dark");
        root.style.colorScheme = "dark";
      } else {
        root.classList.add("light");
        root.style.colorScheme = "light";
      }
    }

    try {
      localStorage.setItem("rehanza-theme", theme);
      localStorage.setItem("app-theme", theme);
      if (userId) {
        localStorage.setItem(`rehanza-theme-${userId}`, theme);
      }
    } catch {
      // ignore
    }

    window.dispatchEvent(new CustomEvent("rehanza-theme-changed", { detail: { theme } }));
  }, [theme, userId]);

  const isBlueTheme = theme === "blue";

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isBlueTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
