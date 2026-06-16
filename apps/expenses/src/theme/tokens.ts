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
