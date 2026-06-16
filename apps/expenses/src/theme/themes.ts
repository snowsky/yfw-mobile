import { spacing, radii, typography, durations } from "./tokens";
import { ColorTokens, ColorScheme, ThemeMode, ThemeTokens } from "./types";

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
