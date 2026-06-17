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
