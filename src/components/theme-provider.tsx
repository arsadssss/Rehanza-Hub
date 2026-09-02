
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from '@/lib/apiFetch';

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  backgroundImage: string;
  setBackgroundImage: (backgroundImage: string) => void;
  resetBackgroundImage: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [backgroundImage, setBackgroundImageState] = useState<string>("");

  useEffect(() => {
    const savedTheme = localStorage.getItem("app-theme") as Theme | null;
    if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") {
      setTheme(savedTheme);
    } else {
      setTheme("dark");
    }

    const savedBackground = localStorage.getItem("app-background-image") || "";
    if (savedBackground) {
      setBackgroundImageState(savedBackground);
    }

    const syncBackgroundFromSettings = async () => {
      try {
        const res = await apiFetch('/api/settings');
        if (!res.ok) return;
        const settings = await res.json();
        const savedSetting = settings?.preferences?.backgroundImage || settings?.backgroundImage || "";
        if (savedSetting) {
          setBackgroundImageState(savedSetting);
          localStorage.setItem("app-background-image", savedSetting);
        } else if (!savedBackground) {
          localStorage.removeItem("app-background-image");
        }
      } catch (error) {
        console.error('Failed to sync background image setting:', error);
      }
    };

    syncBackgroundFromSettings();
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }

    root.style.colorScheme = theme === "light" ? "light" : "dark";
    localStorage.setItem("app-theme", theme);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    const safeBackground = backgroundImage && (backgroundImage.startsWith('data:') || backgroundImage.startsWith('http'))
      ? backgroundImage
      : "";

    root.style.setProperty('--app-background-image', safeBackground ? `url("${safeBackground}")` : 'none');
    root.style.setProperty('--app-background-opacity', safeBackground ? '1' : '0');

    if (safeBackground) {
      localStorage.setItem('app-background-image', safeBackground);
    } else {
      localStorage.removeItem('app-background-image');
    }
  }, [backgroundImage]);

  const setBackgroundImage = (value: string) => {
    setBackgroundImageState(value || "");
  };

  const resetBackgroundImage = () => {
    setBackgroundImageState("");
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, backgroundImage, setBackgroundImage, resetBackgroundImage }}>
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
