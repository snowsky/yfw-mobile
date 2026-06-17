import React from "react";
import { View } from "react-native";

import { useTheme } from "../../theme";
import { Text } from "./Text";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: tokens.spacing["3xl"], gap: tokens.spacing.sm }}>
      {icon}
      <Text variant="headingMd" center>{title}</Text>
      {description ? <Text variant="bodyMd" color="textMuted" center>{description}</Text> : null}
      {action ? <View style={{ marginTop: tokens.spacing.md }}>{action}</View> : null}
    </View>
  );
}
