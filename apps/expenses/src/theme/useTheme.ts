import { useContext, useMemo } from "react";
import { StyleSheet } from "react-native";

import { ThemeContext, ThemeContextValue } from "./ThemeProvider";
import { ThemeTokens } from "./types";

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}

// Build a StyleSheet from tokens, memoized so it only rebuilds when the theme changes.
type NamedStyles<T> = StyleSheet.NamedStyles<T>;

export function useThemedStyles<T extends NamedStyles<T>>(
  factory: (t: ThemeTokens) => T
): T {
  const { tokens } = useTheme();
  // Rebuild only when the resolved scheme changes (light<->dark).
  return useMemo(() => StyleSheet.create(factory(tokens)), [tokens]);
}
