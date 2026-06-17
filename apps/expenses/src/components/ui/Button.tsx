import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

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

const HEIGHT: Record<Size, number> = { sm: 36, md: 46, lg: 54 };
const PAD_X: Record<Size, number> = { sm: 14, md: 18, lg: 22 };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  label, onPress, variant = "primary", size = "md",
  loading, disabled, leftIcon, rightIcon, fullWidth, style,
}: ButtonProps) {
  const { tokens } = useTheme();
  const c = tokens.color;
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

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
  const useGradient = variant === "primary";

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      onPressIn={() => { scale.value = withSpring(0.97, { damping: 18, stiffness: 320 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 18, stiffness: 320 }); }}
      style={[
        styles.base,
        {
          height: HEIGHT[size],
          paddingHorizontal: PAD_X[size],
          backgroundColor: useGradient ? "transparent" : bg[variant],
          borderColor: border,
          borderWidth: variant === "outline" ? 1 : 0,
          borderRadius: tokens.radii.lg,
          opacity: isDisabled ? 0.5 : 1,
          overflow: "hidden",
          width: fullWidth ? "100%" : undefined,
          ...(variant === "primary" || variant === "destructive" ? tokens.shadow.soft : null),
        },
        animatedStyle,
        style,
      ]}
    >
      {useGradient ? (
        <LinearGradient
          colors={tokens.gradient.brand as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
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
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center", flexDirection: "row" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: { alignItems: "center", justifyContent: "center" },
  label: { fontFamily: "Inter_600SemiBold" },
});
