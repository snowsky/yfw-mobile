import React from "react";
import { View } from "react-native";

import { useTheme } from "../../theme";
import { Text } from "./Text";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: tokens.spacing.lg }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headingXl">{title}</Text>
        {subtitle ? <Text variant="bodyMd" color="textMuted">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}
