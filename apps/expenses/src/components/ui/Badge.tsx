import React from "react";
import { View, ViewStyle } from "react-native";

import { useTheme } from "../../theme";
import { Text } from "./Text";

type Status = "success" | "warning" | "danger" | "info" | "neutral";
type Appearance = "solid" | "soft" | "outline";

export interface BadgeProps {
  label: string;
  status?: Status;
  appearance?: Appearance;
  leftIcon?: React.ReactNode;
}

export function Badge({ label, status = "neutral", appearance = "soft", leftIcon }: BadgeProps) {
  const { tokens } = useTheme();
  const c = tokens.color;
  const statusColor: Record<Status, string> = {
    success: c.success, warning: c.warning, danger: c.danger, info: c.info, neutral: c.textMuted,
  };
  const accent = statusColor[status];

  let container: ViewStyle;
  let textColor: string;
  if (appearance === "solid") {
    container = { backgroundColor: accent };
    textColor = c.onPrimary;
  } else if (appearance === "outline") {
    container = { borderWidth: 1, borderColor: accent, backgroundColor: "transparent" };
    textColor = accent;
  } else {
    container = { backgroundColor: accent + "1F" }; // ~12% alpha tint
    textColor = accent;
  }

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          alignSelf: "flex-start",
          paddingHorizontal: tokens.spacing.sm,
          paddingVertical: 3,
          borderRadius: tokens.radii.full,
        },
        container,
      ]}
    >
      {leftIcon}
      <Text variant="caption" style={{ color: textColor }}>{label}</Text>
    </View>
  );
}
