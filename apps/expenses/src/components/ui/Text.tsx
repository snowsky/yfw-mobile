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
