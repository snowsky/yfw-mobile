import { View, ViewProps, ViewStyle } from "react-native";

import { useTheme } from "../../theme";
import { spacing } from "../../theme/tokens";

type Variant = "default" | "elevated";

export interface CardProps extends ViewProps {
  variant?: Variant;
  padding?: keyof typeof spacing;
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
