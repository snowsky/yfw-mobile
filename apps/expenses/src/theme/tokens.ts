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

// Radius scale tuned for a premium, layered feel — softer corners on cards
// and surfaces while keeping controls crisp.
export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 18,
  "2xl": 24,
  full: 999,
} as const;

// Inter weights loaded in app/_layout.tsx: 300/400/500/600/700 (matches the web UI).
export const fontFamily = {
  light: "Inter_300Light",
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
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
  display:   { fontSize: 40, lineHeight: 44, fontFamily: fontFamily.bold,     letterSpacing: -1 },
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
