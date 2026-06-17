import { spacing, radii, typography, durations } from "./tokens";
import { ColorTokens, ColorScheme, ThemeMode, ThemeTokens } from "./types";

// Light: invoice_app's "warm paper" identity — off-white paper background, deep
// ink text, deep forest-green brand, emerald success, brick-red destructive.
const lightColors: ColorTokens = {
  background: "#FAF9F7",
  surface: "#FFFFFF",
  surfaceMuted: "#F4F2EE",
  border: "#E7E4DE",
  text: "#1A1A18",
  textMuted: "#5C5A54",
  textSubtle: "#9A988F",
  primary: "#0E7A4D",
  primaryMuted: "#E3F0E9",
  onPrimary: "#FFFFFF",
  success: "#15834E",
  warning: "#B45309",
  danger: "#B4271A",
  info: "#0F6FA8",
  catFood: "#B45309",
  catTravel: "#1D4ED8",
  catOffice: "#6D28D9",
  catTech: "#0E7490",
  catUtility: "#A16207",
  catMarketing: "#BE185D",
};

// Dark: invoice_app's "warm ink" identity — warm charcoal surfaces (not cold
// blue), cream text, brightened forest-green brand.
const darkColors: ColorTokens = {
  background: "#15140F",
  surface: "#1E1D16",
  surfaceMuted: "#27261D",
  border: "#34322A",
  text: "#F2F0E9",
  textMuted: "#B6B3A8",
  textSubtle: "#7C7A70",
  primary: "#3ECF8E",
  primaryMuted: "#10362B",
  onPrimary: "#08160F",
  success: "#3ECF8E",
  warning: "#FBBF24",
  danger: "#F4796B",
  info: "#56B6E6",
  catFood: "#FBBF24",
  catTravel: "#7AA2F7",
  catOffice: "#B69BF5",
  catTech: "#3FC7D4",
  catUtility: "#E2C04A",
  catMarketing: "#F07CB0",
};

// Premium depth: low-opacity, large-radius, diffuse shadows that read as a
// soft float rather than a hard drop.
const lightShadow = (color: string): ThemeTokens["shadow"] => ({
  soft:   { shadowColor: color, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },  elevation: 2 },
  medium: { shadowColor: color, shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 8 },  elevation: 6 },
  strong: { shadowColor: color, shadowOpacity: 0.12, shadowRadius: 40, shadowOffset: { width: 0, height: 16 }, elevation: 12 },
});

const darkShadow = (): ThemeTokens["shadow"] => ({
  soft:   { shadowColor: "#000000", shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },  elevation: 2 },
  medium: { shadowColor: "#000000", shadowOpacity: 0.38, shadowRadius: 24, shadowOffset: { width: 0, height: 8 },  elevation: 6 },
  strong: { shadowColor: "#000000", shadowOpacity: 0.50, shadowRadius: 40, shadowOffset: { width: 0, height: 16 }, elevation: 12 },
});

const lightGradient: ThemeTokens["gradient"] = {
  brand: ["#15A06A", "#0B6B43"],
  surface: ["#FFFFFF", "#F6F4EF"],
  heroTint: ["#EAF4EE", "#FAF9F7"],
};

const darkGradient: ThemeTokens["gradient"] = {
  brand: ["#46D89A", "#2BB07A"],
  surface: ["#23221A", "#1A1913"],
  heroTint: ["#1B3329", "#1E1D16"],
};

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
    gradient: scheme === "light" ? lightGradient : darkGradient,
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
