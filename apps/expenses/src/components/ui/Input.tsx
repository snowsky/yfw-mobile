import { useState } from "react";
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
