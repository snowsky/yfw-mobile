import { View, ViewProps, ViewStyle, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "../../theme";
import { spacing } from "../../theme/tokens";

type Variant = "default" | "elevated" | "gradient";

export interface CardProps extends ViewProps {
  variant?: Variant;
  padding?: keyof typeof spacing;
}

export function Card({ variant = "default", padding = "lg", style, children, ...rest }: CardProps) {
  const { tokens } = useTheme();
  const base: ViewStyle = {
    backgroundColor: variant === "gradient" ? "transparent" : tokens.color.surface,
    borderRadius: tokens.radii.xl,
    padding: tokens.spacing[padding],
    overflow: "hidden",
  };
  const decoration: ViewStyle =
    variant === "elevated"
      ? tokens.shadow.medium
      : variant === "gradient"
      ? tokens.shadow.medium
      : { borderWidth: 1, borderColor: tokens.color.border };
  return (
    <View style={[base, decoration, style]} {...rest}>
      {variant === "gradient" ? (
        <LinearGradient
          colors={tokens.gradient.surface as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {children}
    </View>
  );
}
