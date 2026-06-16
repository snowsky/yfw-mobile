import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemeMode, ThemeTokens, ColorScheme } from "./types";
import { resolveTheme } from "./themes";

const STORAGE_KEY = "yfw.expenses.themeMode";

export interface ThemeContextValue {
  tokens: ThemeTokens;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  scheme: ColorScheme; // the resolved scheme actually in effect
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme: ColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const [mode, setModeState] = useState<ThemeMode>("system");

  // Restore persisted mode on mount.
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (active && (stored === "light" || stored === "dark" || stored === "system")) {
        setModeState(stored);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      /* preference is best-effort; ignore write failures */
    });
  }, []);

  const tokens = useMemo(() => resolveTheme(mode, systemScheme), [mode, systemScheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ tokens, mode, setMode, scheme: tokens.scheme }),
    [tokens, mode, setMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
