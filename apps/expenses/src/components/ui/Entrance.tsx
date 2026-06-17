import React from "react";
import { ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

export interface EntranceProps {
  children: React.ReactNode;
  // Staggered list index — later items fade in slightly later.
  index?: number;
  style?: ViewStyle;
}

// Subtle fade-in-up used for list items and cards. Stagger is capped so long
// lists don't animate forever.
export function Entrance({ children, index = 0, style }: EntranceProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(280).delay(Math.min(index * 35, 280))}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
