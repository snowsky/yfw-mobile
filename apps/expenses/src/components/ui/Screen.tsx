import React from "react";
import { ScrollView, StyleProp, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../../theme";

export interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  edges?: ("top" | "bottom" | "left" | "right")[];
}

export function Screen({ children, scroll, contentContainerStyle, edges = ["top"] }: ScreenProps) {
  const { tokens } = useTheme();
  const bg = { flex: 1, backgroundColor: tokens.color.background };
  return (
    <SafeAreaView style={bg} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[{ padding: tokens.spacing.lg, paddingBottom: 120 }, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, padding: tokens.spacing.lg }, contentContainerStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}
