import React from "react";
import { View } from "react-native";

import { Card } from "./Card";
import { Text, TextProps } from "./Text";

export interface MetricCardProps {
  label: string;
  value: string;
  change?: string;
  changeStatus?: "success" | "danger" | "neutral";
  icon?: React.ReactNode;
}

export function MetricCard({ label, value, change, changeStatus = "neutral", icon }: MetricCardProps) {
  const changeColor: TextProps["color"] =
    changeStatus === "success" ? "success" : changeStatus === "danger" ? "danger" : "textMuted";
  return (
    <Card variant="elevated" style={{ flex: 1, gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text variant="bodySm" color="textMuted">{label}</Text>
        {icon}
      </View>
      <Text variant="headingLg">{value}</Text>
      {change ? <Text variant="bodySm" color={changeColor}>{change}</Text> : null}
    </Card>
  );
}
