import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, ViewStyle } from "react-native";

import { useTheme } from "../../theme";
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
  label: { fontFamily: "Inter_600SemiBold" },
});
