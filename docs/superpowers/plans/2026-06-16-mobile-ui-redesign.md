# Mobile UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the whole `@yfw-mobile/expenses` Expo app to match the *feel* of the YFW web UI by introducing a design-token system, a shared component library, and light/dark theming with an in-app picker — keeping the teal brand and Outfit font.

**Architecture:** A `ThemeProvider` exposes typed `tokens` (colors/spacing/radii/typography/shadows) for the resolved theme. The `useThemedStyles(makeStyles)` hook memoizes a `StyleSheet` per theme so components stay performant while reacting to theme switches. A shared `src/components/ui/` library (Text, Button, Card, Input, Badge, etc.) is built on tokens, then every screen is migrated off hardcoded hex onto tokens + these components. No behavior, routes, or API calls change.

**Tech Stack:** Expo SDK 54, React Native 0.81, React 19, expo-router 5, TypeScript, `@react-native-async-storage/async-storage` (new), `expo-linear-gradient` + `react-native-safe-area-context` (existing), Outfit font (already loaded: 300/400/500/600/700).

> **Testing reality:** This project has **no test runner wired** (CLAUDE.md), and adding one is an explicit spec non-goal. The verification gate for every task is therefore: **(1) `cd apps/expenses && npx tsc --noEmit` is clean**, **(2) a grep gate** that migrated screens contain no raw hex literals, and **(3) a manual simulator pass in light + dark**. Where a task adds pure logic (theme resolution), the step includes an inline assertion block to reason through by hand. Run the app with `npm run dev:expenses` from the workspace root.

> **Path note:** All paths below are relative to the repo root `/Users/hao/dev/github/machine_learning/hao_projects/yfw-mobile`. The app lives in `apps/expenses`. `tsc` must be run from inside `apps/expenses`.

---

## File Structure

**Create (Phase 1 — foundation):**
- `apps/expenses/src/theme/tokens.ts` — mode-independent primitives (spacing, radii, typography scale, shadows, durations).
- `apps/expenses/src/theme/types.ts` — `ThemeMode`, `ColorTokens`, `ThemeTokens` types.
- `apps/expenses/src/theme/themes.ts` — `lightColors`, `darkColors`, `resolveTheme()`.
- `apps/expenses/src/theme/ThemeProvider.tsx` — context, mode state, AsyncStorage persistence.
- `apps/expenses/src/theme/useTheme.ts` — `useTheme()`, `useThemedStyles()`.
- `apps/expenses/src/theme/index.ts` — barrel.
- `apps/expenses/src/components/ui/Text.tsx`
- `apps/expenses/src/components/ui/Button.tsx`
- `apps/expenses/src/components/ui/Card.tsx`
- `apps/expenses/src/components/ui/Input.tsx`
- `apps/expenses/src/components/ui/Badge.tsx`
- `apps/expenses/src/components/ui/Screen.tsx`
- `apps/expenses/src/components/ui/index.ts` — barrel.

**Create (Phase 2 — more primitives):**
- `apps/expenses/src/components/ui/PageHeader.tsx`
- `apps/expenses/src/components/ui/EmptyState.tsx`
- `apps/expenses/src/components/ui/MetricCard.tsx`
- `apps/expenses/src/components/ui/FilterChip.tsx`
- `apps/expenses/src/components/ui/SegmentedControl.tsx`
- `apps/expenses/src/components/ui/Avatar.tsx`
- `apps/expenses/src/components/ui/Divider.tsx`

**Modify:**
- `apps/expenses/app/_layout.tsx` — wrap tree in `ThemeProvider`, theme-driven `StatusBar`.
- `apps/expenses/app/(tabs)/_layout.tsx` — token-driven tab bar.
- `apps/expenses/app/(tabs)/{capture,inbox,timeline,insights,settings}.tsx`
- `apps/expenses/app/{login,oauth-callback,index}.tsx`
- `apps/expenses/app/expense/[id].tsx`, `apps/expenses/app/review.tsx`
- `apps/expenses/src/components/{SwipeableRow,SwipeCard,UndoToast}.tsx` — re-skin onto tokens.
- `apps/expenses/package.json` — add AsyncStorage.

---

# Phase 1 — Foundation

### Task 1: Add AsyncStorage dependency

**Files:**
- Modify: `apps/expenses/package.json`

- [ ] **Step 1: Install via expo (ensures SDK-compatible version)**

Run from repo root:
```bash
cd apps/expenses && npx expo install @react-native-async-storage/async-storage
```
Expected: `package.json` gains `"@react-native-async-storage/async-storage"` under dependencies; install completes. If install fails on peer deps, retry with the workspace's known workaround `npm install --legacy-peer-deps` from the repo root (see project memory).

- [ ] **Step 2: Verify it resolves**

Run:
```bash
cd apps/expenses && node -e "require.resolve('@react-native-async-storage/async-storage')" && echo OK
```
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add apps/expenses/package.json package-lock.json
git commit -m "chore: add async-storage for theme preference persistence"
```

---

### Task 2: Design tokens (primitives)

**Files:**
- Create: `apps/expenses/src/theme/tokens.ts`

- [ ] **Step 1: Write `tokens.ts`**

```typescript
// Mode-independent primitives. Colors live in themes.ts (they vary by theme).
import { TextStyle } from "react-native";

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 24,
  full: 999,
} as const;

// Outfit weights already loaded in app/_layout.tsx: 300/400/500/600/700.
export const fontFamily = {
  light: "Outfit_300Light",
  regular: "Outfit_400Regular",
  medium: "Outfit_500Medium",
  semibold: "Outfit_600SemiBold",
  bold: "Outfit_700Bold",
} as const;

// Type scale adapted from the web UI's scale, tuned for mobile.
// Each variant carries size, line height, weight, and letter spacing.
type TypeVariant = Pick<TextStyle, "fontSize" | "lineHeight" | "fontFamily" | "letterSpacing">;

export const typography: Record<
  | "display"
  | "headingXl"
  | "headingLg"
  | "headingMd"
  | "headingSm"
  | "bodyLg"
  | "bodyMd"
  | "bodySm"
  | "caption",
  TypeVariant
> = {
  display:   { fontSize: 34, lineHeight: 40, fontFamily: fontFamily.bold,     letterSpacing: -0.5 },
  headingXl: { fontSize: 28, lineHeight: 34, fontFamily: fontFamily.bold,     letterSpacing: -0.4 },
  headingLg: { fontSize: 22, lineHeight: 28, fontFamily: fontFamily.semibold, letterSpacing: -0.3 },
  headingMd: { fontSize: 18, lineHeight: 24, fontFamily: fontFamily.semibold, letterSpacing: -0.2 },
  headingSm: { fontSize: 16, lineHeight: 22, fontFamily: fontFamily.semibold, letterSpacing: 0 },
  bodyLg:    { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.regular,  letterSpacing: 0 },
  bodyMd:    { fontSize: 14, lineHeight: 20, fontFamily: fontFamily.regular,  letterSpacing: 0 },
  bodySm:    { fontSize: 12, lineHeight: 16, fontFamily: fontFamily.regular,  letterSpacing: 0.1 },
  caption:   { fontSize: 11, lineHeight: 14, fontFamily: fontFamily.medium,   letterSpacing: 0.4 },
};

export const durations = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;
```

- [ ] **Step 2: Verify**

Run: `cd apps/expenses && npx tsc --noEmit`
Expected: no errors referencing `tokens.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/expenses/src/theme/tokens.ts
git commit -m "feat(theme): add primitive design tokens"
```

---

### Task 3: Theme types

**Files:**
- Create: `apps/expenses/src/theme/types.ts`

- [ ] **Step 1: Write `types.ts`**

```typescript
import { spacing, radii, typography, durations } from "./tokens";

export type ThemeMode = "system" | "light" | "dark";
export type ColorScheme = "light" | "dark";

// Semantic color tokens. Same keys for every theme; values differ per scheme.
export interface ColorTokens {
  background: string;     // screen background
  surface: string;        // card / elevated surface
  surfaceMuted: string;   // inset / secondary surface
  border: string;         // hairlines, dividers, input borders
  text: string;           // primary text / ink
  textMuted: string;      // secondary text
  textSubtle: string;     // tertiary text / placeholders
  primary: string;        // brand teal
  primaryMuted: string;   // soft brand background (pills, tints)
  onPrimary: string;      // text/icon on primary
  success: string;
  warning: string;
  danger: string;
  info: string;
  // Category accent colors (carried from timeline.tsx).
  catFood: string;
  catTravel: string;
  catOffice: string;
  catTech: string;
  catUtility: string;
  catMarketing: string;
}

export interface Shadow {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
}

export interface ThemeTokens {
  scheme: ColorScheme;
  color: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  durations: typeof durations;
  shadow: {
    soft: Shadow;
    medium: Shadow;
    strong: Shadow;
  };
}
```

- [ ] **Step 2: Verify**

Run: `cd apps/expenses && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/expenses/src/theme/types.ts
git commit -m "feat(theme): add theme token types"
```

---

### Task 4: Light & dark themes + resolver

**Files:**
- Create: `apps/expenses/src/theme/themes.ts`

- [ ] **Step 1: Write `themes.ts`**

```typescript
import { spacing, radii, typography, durations } from "./tokens";
import { ColorTokens, ColorScheme, ThemeMode, ThemeTokens, Shadow } from "./types";

// Light: warm-paper surfaces, deep ink text, teal brand (kept from current app).
const lightColors: ColorTokens = {
  background: "#FAF9F7",
  surface: "#FFFFFF",
  surfaceMuted: "#F4F2EE",
  border: "#E7E4DE",
  text: "#1A1A18",
  textMuted: "#5C5A54",
  textSubtle: "#9A988F",
  primary: "#059669",
  primaryMuted: "#E5F4EE",
  onPrimary: "#FFFFFF",
  success: "#059669",
  warning: "#D97706",
  danger: "#DC2626",
  info: "#0284C7",
  catFood: "#D97706",
  catTravel: "#2563EB",
  catOffice: "#7C3AED",
  catTech: "#0891B2",
  catUtility: "#CA8A04",
  catMarketing: "#DB2777",
};

// Dark: warm charcoal (not cold blue) surfaces, cream text, brightened teal.
const darkColors: ColorTokens = {
  background: "#16150F",
  surface: "#1F1E17",
  surfaceMuted: "#27261D",
  border: "#34322A",
  text: "#F2F0E9",
  textMuted: "#B6B3A8",
  textSubtle: "#7C7A70",
  primary: "#34D399",
  primaryMuted: "#10362B",
  onPrimary: "#08160F",
  success: "#34D399",
  warning: "#FBBF24",
  danger: "#F87171",
  info: "#38BDF8",
  catFood: "#FBBF24",
  catTravel: "#60A5FA",
  catOffice: "#A78BFA",
  catTech: "#22D3EE",
  catUtility: "#FACC15",
  catMarketing: "#F472B6",
};

const lightShadow = (color: string): ThemeTokens["shadow"] => ({
  soft:   { shadowColor: color, shadowOpacity: 0.06, shadowRadius: 8,  shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  medium: { shadowColor: color, shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  strong: { shadowColor: color, shadowOpacity: 0.16, shadowRadius: 28, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
});

const darkShadow = (): ThemeTokens["shadow"] => ({
  soft:   { shadowColor: "#000000", shadowOpacity: 0.30, shadowRadius: 8,  shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  medium: { shadowColor: "#000000", shadowOpacity: 0.40, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  strong: { shadowColor: "#000000", shadowOpacity: 0.55, shadowRadius: 28, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
});

function makeTheme(scheme: ColorScheme): ThemeTokens {
  const color = scheme === "light" ? lightColors : darkColors;
  return {
    scheme,
    color,
    spacing,
    radii,
    typography,
    durations,
    shadow: scheme === "light" ? lightShadow("#1A1A18") : darkShadow(),
  };
}

export const lightTheme = makeTheme("light");
export const darkTheme = makeTheme("dark");

// Resolve the active theme from the user's mode + the OS scheme.
export function resolveTheme(mode: ThemeMode, systemScheme: ColorScheme): ThemeTokens {
  if (mode === "light") return lightTheme;
  if (mode === "dark") return darkTheme;
  return systemScheme === "dark" ? darkTheme : lightTheme;
}
```

- [ ] **Step 2: Reason through the resolver by hand (no runner available)**

Confirm these hold by reading `resolveTheme`:
```
resolveTheme("light", "dark")  === lightTheme   // forced light ignores OS
resolveTheme("dark",  "light") === darkTheme    // forced dark ignores OS
resolveTheme("system","dark")  === darkTheme    // follows OS
resolveTheme("system","light") === lightTheme   // follows OS
```

- [ ] **Step 3: Verify**

Run: `cd apps/expenses && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/expenses/src/theme/themes.ts
git commit -m "feat(theme): add light/dark color themes and resolver"
```

---

### Task 5: ThemeProvider with persistence

**Files:**
- Create: `apps/expenses/src/theme/ThemeProvider.tsx`

- [ ] **Step 1: Write `ThemeProvider.tsx`**

```tsx
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
```

- [ ] **Step 2: Verify**

Run: `cd apps/expenses && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/expenses/src/theme/ThemeProvider.tsx
git commit -m "feat(theme): add ThemeProvider with persisted mode"
```

---

### Task 6: useTheme / useThemedStyles hooks + barrel

**Files:**
- Create: `apps/expenses/src/theme/useTheme.ts`
- Create: `apps/expenses/src/theme/index.ts`

- [ ] **Step 1: Write `useTheme.ts`**

```typescript
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
```

- [ ] **Step 2: Write `index.ts` barrel**

```typescript
export * from "./tokens";
export * from "./types";
export * from "./themes";
export { ThemeProvider, ThemeContext } from "./ThemeProvider";
export type { ThemeContextValue } from "./ThemeProvider";
export { useTheme, useThemedStyles } from "./useTheme";
```

- [ ] **Step 3: Verify**

Run: `cd apps/expenses && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/expenses/src/theme/useTheme.ts apps/expenses/src/theme/index.ts
git commit -m "feat(theme): add useTheme/useThemedStyles hooks and barrel"
```

---

### Task 7: Wire ThemeProvider + theme-driven StatusBar into root layout

**Files:**
- Modify: `apps/expenses/app/_layout.tsx`

- [ ] **Step 1: Add a themed StatusBar helper and wrap the tree**

Replace the `return (...)` block in `RootLayout` and add a small inner component. The full new file body (keep the existing font-loading logic above untouched):

```tsx
import { ThemeProvider, useTheme } from "../src/theme";
// ...existing imports stay...

function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === "dark" ? "light" : "dark"} />;
}

// inside RootLayout's return:
return (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemedStatusBar />
          <Stack screenOptions={{ headerShown: false }} />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </GestureHandlerRootView>
);
```

Remove the old hardcoded `<StatusBar style="dark" />`.

- [ ] **Step 2: Verify types + app boots**

Run: `cd apps/expenses && npx tsc --noEmit`
Expected: no errors.
Then run `npm run dev:expenses` from repo root and open the app — it should boot exactly as before (no visual change yet; provider is just installed).

- [ ] **Step 3: Commit**

```bash
git add apps/expenses/app/_layout.tsx
git commit -m "feat(theme): wire ThemeProvider and theme-driven StatusBar"
```

---

### Task 8: `Text` component

**Files:**
- Create: `apps/expenses/src/components/ui/Text.tsx`

- [ ] **Step 1: Write `Text.tsx`**

```tsx
import React from "react";
import { Text as RNText, TextProps as RNTextProps } from "react-native";

import { useTheme } from "../../theme";
import { typography } from "../../theme/tokens";
import { ColorTokens } from "../../theme/types";

type Variant = keyof typeof typography;
// Color keys that make sense for text.
type ColorKey = "text" | "textMuted" | "textSubtle" | "primary" | "onPrimary" | "success" | "warning" | "danger" | "info";

export interface TextProps extends RNTextProps {
  variant?: Variant;
  color?: ColorKey;
  center?: boolean;
}

export function Text({ variant = "bodyMd", color = "text", center, style, ...rest }: TextProps) {
  const { tokens } = useTheme();
  const colorValue = tokens.color[color as keyof ColorTokens];
  return (
    <RNText
      style={[
        typography[variant],
        { color: colorValue },
        center ? { textAlign: "center" } : null,
        style,
      ]}
      {...rest}
    />
  );
}
```

- [ ] **Step 2: Verify**

Run: `cd apps/expenses && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/expenses/src/components/ui/Text.tsx
git commit -m "feat(ui): add themed Text component"
```

---

### Task 9: Core primitives — Button, Card, Input, Badge, Screen + barrel

**Files:**
- Create: `apps/expenses/src/components/ui/Button.tsx`
- Create: `apps/expenses/src/components/ui/Card.tsx`
- Create: `apps/expenses/src/components/ui/Input.tsx`
- Create: `apps/expenses/src/components/ui/Badge.tsx`
- Create: `apps/expenses/src/components/ui/Screen.tsx`
- Create: `apps/expenses/src/components/ui/index.ts`

- [ ] **Step 1: Write `Button.tsx`**

```tsx
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, ViewStyle } from "react-native";

import { useTheme } from "../../theme";
import { ThemeTokens } from "../../theme/types";
import { Text } from "./Text";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const HEIGHT: Record<Size, number> = { sm: 36, md: 44, lg: 52 };
const PAD_X: Record<Size, number> = { sm: 12, md: 16, lg: 20 };

export function Button({
  label, onPress, variant = "primary", size = "md",
  loading, disabled, leftIcon, rightIcon, fullWidth, style,
}: ButtonProps) {
  const { tokens } = useTheme();
  const c = tokens.color;
  const isDisabled = disabled || loading;

  const bg: Record<Variant, string> = {
    primary: c.primary,
    secondary: c.surfaceMuted,
    outline: "transparent",
    ghost: "transparent",
    destructive: c.danger,
  };
  const fg: Record<Variant, "onPrimary" | "text" | "primary" | "danger"> = {
    primary: "onPrimary",
    secondary: "text",
    outline: "primary",
    ghost: "primary",
    destructive: "onPrimary",
  };
  const border = variant === "outline" ? c.primary : "transparent";

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHT[size],
          paddingHorizontal: PAD_X[size],
          backgroundColor: bg[variant],
          borderColor: border,
          borderWidth: variant === "outline" ? 1 : 0,
          borderRadius: tokens.radii.lg,
          opacity: isDisabled ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          width: fullWidth ? "100%" : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg[variant] === "onPrimary" ? c.onPrimary : c.primary} />
      ) : (
        <View style={styles.row}>
          {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
          <Text variant={size === "sm" ? "bodySm" : "bodyMd"} color={fg[variant]} style={styles.label}>
            {label}
          </Text>
          {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center", flexDirection: "row" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: { alignItems: "center", justifyContent: "center" },
  label: { fontFamily: "Outfit_600SemiBold" },
});
```

- [ ] **Step 2: Write `Card.tsx`**

```tsx
import React from "react";
import { View, ViewProps, ViewStyle } from "react-native";

import { useTheme } from "../../theme";

type Variant = "default" | "elevated";

export interface CardProps extends ViewProps {
  variant?: Variant;
  padding?: keyof ReturnType<typeof usePaddingScale>;
}

function usePaddingScale() {
  const { tokens } = useTheme();
  return tokens.spacing;
}

export function Card({ variant = "default", padding = "lg", style, children, ...rest }: CardProps) {
  const { tokens } = useTheme();
  const base: ViewStyle = {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radii.xl,
    padding: tokens.spacing[padding],
  };
  const decoration: ViewStyle =
    variant === "elevated"
      ? tokens.shadow.medium
      : { borderWidth: 1, borderColor: tokens.color.border };
  return (
    <View style={[base, decoration, style]} {...rest}>
      {children}
    </View>
  );
}
```

- [ ] **Step 3: Write `Input.tsx`**

```tsx
import React, { useState } from "react";
import { TextInput, TextInputProps, View } from "react-native";

import { useTheme } from "../../theme";
import { typography } from "../../theme/tokens";
import { Text } from "./Text";

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, onFocus, onBlur, ...rest }: InputProps) {
  const { tokens } = useTheme();
  const c = tokens.color;
  const [focused, setFocused] = useState(false);
  const borderColor = error ? c.danger : focused ? c.primary : c.border;

  return (
    <View style={{ gap: tokens.spacing.xs }}>
      {label ? <Text variant="bodySm" color="textMuted">{label}</Text> : null}
      <TextInput
        placeholderTextColor={c.textSubtle}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        style={[
          typography.bodyMd,
          {
            color: c.text,
            backgroundColor: c.surfaceMuted,
            borderWidth: 1,
            borderColor,
            borderRadius: tokens.radii.lg,
            paddingHorizontal: tokens.spacing.md,
            paddingVertical: tokens.spacing.md,
          },
          style,
        ]}
        {...rest}
      />
      {error ? <Text variant="bodySm" color="danger">{error}</Text> : null}
    </View>
  );
}
```

- [ ] **Step 4: Write `Badge.tsx`**

```tsx
import React from "react";
import { View, ViewStyle } from "react-native";

import { useTheme } from "../../theme";
import { Text } from "./Text";

type Status = "success" | "warning" | "danger" | "info" | "neutral";
type Appearance = "solid" | "soft" | "outline";

export interface BadgeProps {
  label: string;
  status?: Status;
  appearance?: Appearance;
  leftIcon?: React.ReactNode;
}

export function Badge({ label, status = "neutral", appearance = "soft", leftIcon }: BadgeProps) {
  const { tokens } = useTheme();
  const c = tokens.color;
  const statusColor: Record<Status, string> = {
    success: c.success, warning: c.warning, danger: c.danger, info: c.info, neutral: c.textMuted,
  };
  const accent = statusColor[status];

  let container: ViewStyle;
  let textColor: string;
  if (appearance === "solid") {
    container = { backgroundColor: accent };
    textColor = c.onPrimary;
  } else if (appearance === "outline") {
    container = { borderWidth: 1, borderColor: accent, backgroundColor: "transparent" };
    textColor = accent;
  } else {
    container = { backgroundColor: accent + "1F" }; // ~12% alpha tint
    textColor = accent;
  }

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          alignSelf: "flex-start",
          paddingHorizontal: tokens.spacing.sm,
          paddingVertical: 3,
          borderRadius: tokens.radii.full,
        },
        container,
      ]}
    >
      {leftIcon}
      <Text variant="caption" style={{ color: textColor }}>{label}</Text>
    </View>
  );
}
```

> Note: the `+ "1F"` hex-alpha trick requires the token to be a 6-digit hex (all are). Keep it consistent.

- [ ] **Step 5: Write `Screen.tsx`**

```tsx
import React from "react";
import { ScrollView, StyleProp, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../../theme";

export interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  edges?: ("top" | "bottom" | "left" | "right")[];
}

export function Screen({ children, scroll, contentContainerStyle, edges = ["top"] }: ScreenProps) {
  const { tokens } = useTheme();
  const bg = { flex: 1, backgroundColor: tokens.color.background };
  return (
    <SafeAreaView style={bg} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[{ padding: tokens.spacing.lg, paddingBottom: 120 }, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, padding: tokens.spacing.lg }, contentContainerStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 6: Write `index.ts` barrel**

```typescript
export { Text } from "./Text";
export type { TextProps } from "./Text";
export { Button } from "./Button";
export type { ButtonProps } from "./Button";
export { Card } from "./Card";
export type { CardProps } from "./Card";
export { Input } from "./Input";
export type { InputProps } from "./Input";
export { Badge } from "./Badge";
export type { BadgeProps } from "./Badge";
export { Screen } from "./Screen";
export type { ScreenProps } from "./Screen";
```

- [ ] **Step 7: Verify**

Run: `cd apps/expenses && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/expenses/src/components/ui/
git commit -m "feat(ui): add Button, Card, Input, Badge, Screen primitives"
```

---

# Phase 2 — Proof + tab bar

> Goal: prove the foundation end-to-end by migrating the **tab bar**, **timeline**, and **insights**, building the remaining primitives those screens need. After this phase, switching the OS between light/dark visibly re-themes these screens.

### Task 10: Secondary primitives — PageHeader, EmptyState, MetricCard, FilterChip, Divider

**Files:**
- Create: `apps/expenses/src/components/ui/PageHeader.tsx`
- Create: `apps/expenses/src/components/ui/EmptyState.tsx`
- Create: `apps/expenses/src/components/ui/MetricCard.tsx`
- Create: `apps/expenses/src/components/ui/FilterChip.tsx`
- Create: `apps/expenses/src/components/ui/Divider.tsx`
- Modify: `apps/expenses/src/components/ui/index.ts`

- [ ] **Step 1: Write `PageHeader.tsx`**

```tsx
import React from "react";
import { View } from "react-native";

import { useTheme } from "../../theme";
import { Text } from "./Text";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: tokens.spacing.lg }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headingXl">{title}</Text>
        {subtitle ? <Text variant="bodyMd" color="textMuted">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}
```

- [ ] **Step 2: Write `EmptyState.tsx`**

```tsx
import React from "react";
import { View } from "react-native";

import { useTheme } from "../../theme";
import { Text } from "./Text";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: tokens.spacing["3xl"], gap: tokens.spacing.sm }}>
      {icon}
      <Text variant="headingMd" center>{title}</Text>
      {description ? <Text variant="bodyMd" color="textMuted" center>{description}</Text> : null}
      {action ? <View style={{ marginTop: tokens.spacing.md }}>{action}</View> : null}
    </View>
  );
}
```

- [ ] **Step 3: Write `MetricCard.tsx`**

```tsx
import React from "react";
import { View } from "react-native";

import { useTheme } from "../../theme";
import { Card } from "./Card";
import { Text } from "./Text";

export interface MetricCardProps {
  label: string;
  value: string;
  change?: string;
  changeStatus?: "success" | "danger" | "neutral";
  icon?: React.ReactNode;
}

export function MetricCard({ label, value, change, changeStatus = "neutral", icon }: MetricCardProps) {
  const { tokens } = useTheme();
  const changeColor =
    changeStatus === "success" ? "success" : changeStatus === "danger" ? "danger" : "textMuted";
  return (
    <Card variant="elevated" style={{ flex: 1, gap: tokens.spacing.xs }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text variant="bodySm" color="textMuted">{label}</Text>
        {icon}
      </View>
      <Text variant="headingLg">{value}</Text>
      {change ? <Text variant="bodySm" color={changeColor as any}>{change}</Text> : null}
    </Card>
  );
}
```

- [ ] **Step 4: Write `FilterChip.tsx`**

```tsx
import React from "react";
import { Pressable } from "react-native";

import { useTheme } from "../../theme";
import { Text } from "./Text";

export interface FilterChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
}

export function FilterChip({ label, active, onPress }: FilterChipProps) {
  const { tokens } = useTheme();
  const c = tokens.color;
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: tokens.spacing.md,
        paddingVertical: tokens.spacing.sm,
        borderRadius: tokens.radii.full,
        backgroundColor: active ? c.primary : c.surfaceMuted,
        borderWidth: 1,
        borderColor: active ? c.primary : c.border,
      }}
    >
      <Text variant="bodySm" style={{ color: active ? c.onPrimary : c.textMuted }}>{label}</Text>
    </Pressable>
  );
}
```

- [ ] **Step 5: Write `Divider.tsx`**

```tsx
import React from "react";
import { View } from "react-native";

import { useTheme } from "../../theme";

export function Divider({ vertical }: { vertical?: boolean }) {
  const { tokens } = useTheme();
  return (
    <View
      style={
        vertical
          ? { width: 1, alignSelf: "stretch", backgroundColor: tokens.color.border }
          : { height: 1, alignSelf: "stretch", backgroundColor: tokens.color.border }
      }
    />
  );
}
```

- [ ] **Step 6: Add the new exports to `index.ts`**

Append:
```typescript
export { PageHeader } from "./PageHeader";
export type { PageHeaderProps } from "./PageHeader";
export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";
export { MetricCard } from "./MetricCard";
export type { MetricCardProps } from "./MetricCard";
export { FilterChip } from "./FilterChip";
export type { FilterChipProps } from "./FilterChip";
export { Divider } from "./Divider";
```

- [ ] **Step 7: Verify & commit**

Run: `cd apps/expenses && npx tsc --noEmit` → no errors.
```bash
git add apps/expenses/src/components/ui/
git commit -m "feat(ui): add PageHeader, EmptyState, MetricCard, FilterChip, Divider"
```

---

### Task 11: Token-driven tab bar

**Files:**
- Modify: `apps/expenses/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Drive tab bar colors from tokens**

The component currently returns early before hooks if `!isReady`. Call `useTheme()` at the top (before the early returns are fine since hooks must run unconditionally — move the hook above the `if (!isReady)` guards). Replace hardcoded colors:

```tsx
import { useTheme } from "../../src/theme";
// ...
export default function TabsLayout() {
  const { tokens, scheme } = useTheme();
  const { isReady, accessToken } = useAuth();
  if (!isReady) return null;
  if (!accessToken) return <Redirect href="/login" />;

  const c = tokens.color;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textSubtle,
        tabBarStyle: {
          position: "absolute",
          bottom: Platform.OS === "ios" ? 28 : 20,
          left: 16, right: 16, height: 66,
          borderRadius: tokens.radii["2xl"],
          backgroundColor: Platform.OS === "ios"
            ? (scheme === "dark" ? "rgba(31,30,23,0.85)" : "rgba(255,255,255,0.85)")
            : c.surface,
          ...tokens.shadow.strong,
          borderTopWidth: 0,
          paddingBottom: Platform.OS === "ios" ? 0 : 4,
          paddingTop: 4,
          overflow: "hidden",
        },
        tabBarBackground: Platform.OS === "ios" ? () => (
          <BlurView tint={scheme === "dark" ? "dark" : "light"} intensity={60} style={StyleSheet.absoluteFill} />
        ) : undefined,
        tabBarLabelStyle: { fontSize: 11, fontFamily: "Outfit_600SemiBold", marginTop: -2, marginBottom: 4 },
        tabBarIconStyle: { marginTop: 2 },
      }}
    >
      {/* Tabs.Screen entries unchanged */}
```

Keep all five `<Tabs.Screen>` entries exactly as-is.

- [ ] **Step 2: Verify**

Run: `cd apps/expenses && npx tsc --noEmit` → no errors. Run the app; toggle OS dark mode — the tab bar background/tint should follow.

- [ ] **Step 3: Commit**

```bash
git add "apps/expenses/app/(tabs)/_layout.tsx"
git commit -m "feat(ui): theme the tab bar via tokens"
```

---

### Task 12: Migrate `timeline.tsx`

**Files:**
- Modify: `apps/expenses/app/(tabs)/timeline.tsx`

This is a **mechanical migration**: keep all data fetching, query keys, search/filter state, swipe behavior, and the undo toast logic exactly as-is. Only the presentation changes.

- [ ] **Step 1: Swap structure to shared components**
  - Wrap the screen body in `<Screen scroll>` (from `../../src/components/ui`) instead of the local `SafeAreaView`/`ScrollView` + background style.
  - Replace the header block with `<PageHeader title="Timeline" subtitle={...} right={...} />`.
  - Replace the search `TextInput` with `<Input ... />` (keep its value/onChangeText wiring).
  - Replace the filter pills with `<FilterChip label active onPress />` mapped over the existing filter options.
  - Replace each list row's container/typography with `<Card>` + `<Text variant=...>`; map category color to `tokens.color.catFood|catTravel|...` (replace the hardcoded `#d97706` etc. — the keys match the token names added in Task 3/4).
  - Replace the summary block (total/count/average) separators with `<Divider vertical />`.

- [ ] **Step 2: Convert local styles to `useThemedStyles`**

Replace the file's `const styles = StyleSheet.create({...})` with:
```tsx
import { useThemedStyles } from "../../src/theme";
// inside component:
const styles = useThemedStyles((t) => ({
  // ...port each style, swapping every hardcoded hex for t.color.*,
  // spacing numbers for t.spacing.*, and radii for t.radii.*
}));
```
Delete the module-level `StyleSheet.create` once all references move into the factory.

- [ ] **Step 3: Grep gate — no raw hex remains**

Run:
```bash
grep -nE "#[0-9a-fA-F]{3,8}" "apps/expenses/app/(tabs)/timeline.tsx" || echo "CLEAN"
```
Expected: `CLEAN` (every color now comes from tokens).

- [ ] **Step 4: Verify**

Run: `cd apps/expenses && npx tsc --noEmit` → no errors. Run the app; open Timeline in light and dark; confirm rows, search, filters, swipe-to-delete + undo all still work and re-theme.

- [ ] **Step 5: Commit**

```bash
git add "apps/expenses/app/(tabs)/timeline.tsx"
git commit -m "feat(ui): migrate Timeline screen to design tokens"
```

---

### Task 13: Migrate `insights.tsx`

**Files:**
- Modify: `apps/expenses/app/(tabs)/insights.tsx`

- [ ] **Step 1: Swap to shared components**
  - `<Screen scroll>` wrapper + `<PageHeader title="Insights" />`.
  - Replace the dark hero metric card and the metric tiles with `<MetricCard label value change changeStatus />`. Drive the trend pill color from `changeStatus` (`success`/`danger`).
  - Replace the category breakdown bars: the bar track uses `tokens.color.surfaceMuted`, the fill uses the matching `tokens.color.cat*`, labels use `<Text>`.

- [ ] **Step 2: Convert styles to `useThemedStyles`** (same pattern as Task 12 Step 2).

- [ ] **Step 3: Grep gate**

Run:
```bash
grep -nE "#[0-9a-fA-F]{3,8}" "apps/expenses/app/(tabs)/insights.tsx" || echo "CLEAN"
```
Expected: `CLEAN`.

- [ ] **Step 4: Verify** — `npx tsc --noEmit` clean; Insights renders in light+dark; metrics + bars correct.

- [ ] **Step 5: Commit**

```bash
git add "apps/expenses/app/(tabs)/insights.tsx"
git commit -m "feat(ui): migrate Insights screen to design tokens"
```

---

# Phase 3 — Remaining tabs + theme picker

### Task 14: SegmentedControl + Avatar primitives

**Files:**
- Create: `apps/expenses/src/components/ui/SegmentedControl.tsx`
- Create: `apps/expenses/src/components/ui/Avatar.tsx`
- Modify: `apps/expenses/src/components/ui/index.ts`

- [ ] **Step 1: Write `SegmentedControl.tsx`**

```tsx
import React from "react";
import { Pressable, View } from "react-native";

import { useTheme } from "../../theme";
import { Text } from "./Text";

export interface SegmentOption<T extends string> {
  label: string;
  value: T;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  const { tokens } = useTheme();
  const c = tokens.color;
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: c.surfaceMuted,
        borderRadius: tokens.radii.lg,
        padding: 3,
        gap: 3,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              { flex: 1, alignItems: "center", paddingVertical: tokens.spacing.sm, borderRadius: tokens.radii.md },
              active ? { backgroundColor: c.surface, ...tokens.shadow.soft } : null,
            ]}
          >
            <Text variant="bodySm" style={{ color: active ? c.text : c.textMuted }}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Write `Avatar.tsx`**

```tsx
import React from "react";
import { View } from "react-native";

import { useTheme } from "../../theme";
import { Text } from "./Text";

export function Avatar({ initials, size = 48 }: { initials: string; size?: number }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: tokens.color.primaryMuted,
        alignItems: "center", justifyContent: "center",
      }}
    >
      <Text variant="headingSm" color="primary">{initials}</Text>
    </View>
  );
}
```

- [ ] **Step 3: Export both from `index.ts`**

```typescript
export { SegmentedControl } from "./SegmentedControl";
export type { SegmentedControlProps, SegmentOption } from "./SegmentedControl";
export { Avatar } from "./Avatar";
```

- [ ] **Step 4: Verify & commit**

`npx tsc --noEmit` clean.
```bash
git add apps/expenses/src/components/ui/
git commit -m "feat(ui): add SegmentedControl and Avatar"
```

---

### Task 15: Migrate `capture.tsx`

**Files:**
- Modify: `apps/expenses/app/(tabs)/capture.tsx`

- [ ] **Step 1: Migrate presentation** (keep ALL capture/voice/receipt state machines, refs, haptics, recording-pulse animation, and API calls unchanged):
  - `<Screen scroll>` wrapper + `<PageHeader>`.
  - Replace the receipt/voice mode switch with `<SegmentedControl options={[{label:"Receipt",value:"receipt"},{label:"Voice",value:"voice"}]} value={mode} onChange={setMode} />`.
  - Replace action buttons with `<Button variant=... leftIcon={<Feather .../>} />`.
  - Keep the gradient hero using existing `expo-linear-gradient`; source the two gradient stops from `[tokens.color.primary, "#10b981"]`-equivalent — define a `tokens`-derived pair: use `[c.primary, c.success]` (both teal family).
  - Draft preview / confidence chips → `<Badge>`.
  - Text inputs → `<Input>`.
- [ ] **Step 2: Convert styles to `useThemedStyles`**.
- [ ] **Step 3: Grep gate**: `grep -nE "#[0-9a-fA-F]{3,8}" "apps/expenses/app/(tabs)/capture.tsx" || echo "CLEAN"` → `CLEAN`.
- [ ] **Step 4: Verify** — `npx tsc --noEmit` clean; record a voice note + scan a receipt in light+dark; both flows still parse/save.
- [ ] **Step 5: Commit**: `git commit -m "feat(ui): migrate Capture screen to design tokens"`.

---

### Task 16: Migrate `inbox.tsx`

**Files:**
- Modify: `apps/expenses/app/(tabs)/inbox.tsx`

- [ ] **Step 1: Migrate presentation** (keep queue logic, status mapping, swipe approve/reject, "Review N" navigation):
  - `<Screen scroll>` + `<PageHeader title="Inbox" right={<Button label={`Review ${n}`} .../>} />` (only when reviews pending).
  - The 4 mini summary stats → a row of small `<Card>` + `<Text>`.
  - Each status pill ("Processing", "Review changes", "Needs attention", "Ready") → `<Badge status=... appearance="soft" />` with this mapping: needs-attention→`warning`, processing→`info`, ready→`success`, review-changes→`danger`.
  - List rows → `<Card>`.
- [ ] **Step 2: Convert styles to `useThemedStyles`**.
- [ ] **Step 3: Grep gate** → `CLEAN`.
- [ ] **Step 4: Verify** — `npx tsc --noEmit` clean; statuses, swipe actions, Review N all work in light+dark.
- [ ] **Step 5: Commit**: `git commit -m "feat(ui): migrate Inbox screen to design tokens"`.

---

### Task 17: Migrate `settings.tsx` + add the theme picker

**Files:**
- Modify: `apps/expenses/app/(tabs)/settings.tsx`

- [ ] **Step 1: Migrate presentation** (keep profile data, digest preference logic, sign-out):
  - `<Screen scroll>` + `<PageHeader title="Settings" />`.
  - Profile block → `<Card>` + `<Avatar initials={...} />` + `<Text>` + org `<Badge>`.
  - Digest frequency control → `<SegmentedControl>`.
  - Sign-out → `<Button variant="destructive" label="Sign out" />`.

- [ ] **Step 2: Add the Appearance / theme picker**

Add a new `<Card>` section titled "Appearance" using the existing theme context:
```tsx
import { useTheme } from "../../src/theme";
import { SegmentedControl } from "../../src/components/ui";
// inside component:
const { mode, setMode } = useTheme();
// ...in JSX:
<Card>
  <Text variant="headingSm" style={{ marginBottom: tokens.spacing.sm }}>Appearance</Text>
  <SegmentedControl
    options={[
      { label: "System", value: "system" },
      { label: "Light", value: "light" },
      { label: "Dark", value: "dark" },
    ]}
    value={mode}
    onChange={setMode}
  />
</Card>
```

- [ ] **Step 3: Convert styles to `useThemedStyles`**.
- [ ] **Step 4: Grep gate** → `CLEAN`.
- [ ] **Step 5: Verify** — `npx tsc --noEmit` clean. Toggle System/Light/Dark: the whole app re-themes instantly; kill and relaunch the app and confirm the choice persisted (AsyncStorage).
- [ ] **Step 6: Commit**: `git commit -m "feat(ui): migrate Settings and add theme picker"`.

---

# Phase 4 — Auth & detail

### Task 18: Migrate `login.tsx` + `oauth-callback.tsx` + `index.tsx`

**Files:**
- Modify: `apps/expenses/app/login.tsx`
- Modify: `apps/expenses/app/oauth-callback.tsx`
- Modify: `apps/expenses/app/index.tsx`

- [ ] **Step 1: Migrate `login.tsx`** (keep email/password state, sign-in/sign-up logic, Google SSO, brand-title config):
  - Background: replace the cool slate gradient with `<Screen>` background + an optional brand glow gradient sourced from `[c.primaryMuted, c.background]`.
  - Form card → `<Card variant="elevated">`; `<Input>` for email/password; `<Button>` for submit + outline button for Google SSO.
- [ ] **Step 2: Migrate `oauth-callback.tsx`** — it's a tiny spinner screen: wrap in `<Screen>` centered, use `<Text>` + an `ActivityIndicator color={tokens.color.primary}`. Keep the base64 decode + storage + `refreshMe` + navigation logic untouched.
- [ ] **Step 3: Migrate `index.tsx`** — redirect screen; if it shows a loading state, theme its background/spinner via tokens. Logic unchanged.
- [ ] **Step 4: Grep gate** on all three → `CLEAN`.
- [ ] **Step 5: Verify** — `npx tsc --noEmit` clean; log out → login screen themed; sign in via password and via Google SSO both still work.
- [ ] **Step 6: Commit**: `git commit -m "feat(ui): migrate auth screens to design tokens"`.

---

### Task 19: Migrate `expense/[id].tsx`

**Files:**
- Modify: `apps/expenses/app/expense/[id].tsx`

- [ ] **Step 1: Migrate presentation** (keep editable-field state, dirty tracking, submit/approve/reject/delete mutations + query invalidation):
  - `<Screen scroll>` + `<PageHeader title="Expense" />`.
  - Each editable field → `<Input label=...>`; category selector can reuse `<SegmentedControl>` or chips.
  - Action buttons → `<Button>` (submit=primary, approve=primary, reject/delete=destructive).
- [ ] **Step 2: Convert styles to `useThemedStyles`**.
- [ ] **Step 3: Grep gate** → `CLEAN`.
- [ ] **Step 4: Verify** — `npx tsc --noEmit` clean; edit/save/approve/reject/delete still work in light+dark.
- [ ] **Step 5: Commit**: `git commit -m "feat(ui): migrate expense detail editor to design tokens"`.

---

### Task 20: Re-skin review flow + shared gesture components

**Files:**
- Modify: `apps/expenses/app/review.tsx`
- Modify: `apps/expenses/src/components/SwipeCard.tsx`
- Modify: `apps/expenses/src/components/SwipeableRow.tsx`
- Modify: `apps/expenses/src/components/UndoToast.tsx`

> Behavior (gesture handling, animations, snap-to-decision, batch commit, haptics) must stay **byte-for-byte** in logic. Only colors/typography move to tokens.

- [ ] **Step 1: `SwipeableRow.tsx`** — replace the action-background colors (approve/delete/reject) with `tokens.color.success`/`danger`/`warning`; icon/label via tokens. Use `useTheme()`.
- [ ] **Step 2: `UndoToast.tsx`** — toast background `tokens.color.text` (ink) on light / `surface` on dark; "Undo" link `tokens.color.primary`; label `<Text>`.
- [ ] **Step 3: `SwipeCard.tsx`** — card surface/border/shadow from tokens; the approve/reject overlay tints from `success`/`danger`.
- [ ] **Step 4: `review.tsx`** — progress counter, completion summary, and buttons via `<Text>`/`<Button>`; `<Screen>` background.
- [ ] **Step 5: Grep gate** on all four files → `CLEAN`.
- [ ] **Step 6: Verify** — `npx tsc --noEmit` clean; run the full review deck (swipe approve/reject/undo, commit) in light+dark; run timeline swipe-delete+undo to confirm re-skinned shared components still behave.
- [ ] **Step 7: Commit**: `git commit -m "feat(ui): re-skin review flow and gesture components"`.

---

### Task 21: Final sweep

**Files:** all migrated screens.

- [ ] **Step 1: Repo-wide hex gate**

Run:
```bash
grep -rnE "#[0-9a-fA-F]{3,8}" apps/expenses/app apps/expenses/src/components \
  | grep -v "src/theme/" || echo "NO STRAY HEX"
```
Expected: `NO STRAY HEX` (all hex now lives only in `src/theme/themes.ts`). If a few legitimate one-offs remain (e.g. gradient strings), confirm each is intentional or move it into tokens.

- [ ] **Step 2: Full typecheck**

Run: `cd apps/expenses && npx tsc --noEmit` → no errors.

- [ ] **Step 3: Manual full pass** — walk every screen (5 tabs, login, oauth, expense detail, review) in **light** and **dark**, plus System mode following an OS toggle. Confirm no unreadable contrast, no clipped layouts, persistence across relaunch.

- [ ] **Step 4: Commit any fixups**

```bash
git commit -am "fix(ui): final theming sweep and contrast fixes"
```

---

## Self-Review notes (author)

- **Spec coverage:** tokens (T2–T4) ✓; ThemeProvider+persistence (T5) ✓; useThemedStyles (T6) ✓; all listed components (T8–T10, T14) ✓; light+dark+picker (T4, T17) ✓; all screens (T11–T20) ✓; SwipeableRow/SwipeCard/UndoToast re-skin (T20) ✓; verification = tsc+grep+manual (every task + T21) ✓.
- **Risk closed:** `Outfit_500Medium` is confirmed loaded in `app/_layout.tsx`, so `fontFamily.medium` is safe.
- **Type consistency:** color keys in `ColorTokens` (Task 3) are reused verbatim by Text/Badge/etc.; category keys `catFood…catMarketing` match between Task 3, Task 4, and Tasks 12/13. `resolveTheme(mode, scheme)` signature is stable across Tasks 4–5.
- **No new test framework** (spec non-goal) — gates are typecheck + grep + manual, stated up front.
