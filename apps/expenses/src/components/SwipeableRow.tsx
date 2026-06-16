import { useRef } from "react";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

import { useTheme } from "../theme";

export type SwipeAction = {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  onTrigger: () => void;
};

type SwipeableRowProps = {
  children: ReactNode;
  leftAction?: SwipeAction; // revealed by swiping the row to the RIGHT
  rightAction?: SwipeAction; // revealed by swiping the row to the LEFT
  disabled?: boolean;
  triggerOnOpen?: boolean; // act as soon as the row is flung open
};

function ActionPanel({
  action,
  align,
  onPress,
}: {
  action: SwipeAction;
  align: "flex-start" | "flex-end";
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      onPress={onPress}
      style={[styles.panel, { backgroundColor: action.color, borderRadius: tokens.radii.xl, alignItems: align }]}
    >
      <View style={styles.panelInner}>
        <Feather name={action.icon} size={22} color={tokens.color.onPrimary} />
        <Text style={[styles.panelLabel, { color: tokens.color.onPrimary }]}>{action.label}</Text>
      </View>
    </Pressable>
  );
}

export function SwipeableRow({
  children,
  leftAction,
  rightAction,
  disabled,
  triggerOnOpen,
}: SwipeableRowProps) {
  const ref = useRef<SwipeableMethods>(null);

  if (disabled || (!leftAction && !rightAction)) {
    return <>{children}</>;
  }

  const fire = (action: SwipeAction) => {
    ref.current?.close();
    action.onTrigger();
  };

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      leftThreshold={72}
      rightThreshold={72}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={
        leftAction
          ? () => (
              <ActionPanel
                action={leftAction}
                align="flex-start"
                onPress={() => fire(leftAction)}
              />
            )
          : undefined
      }
      renderRightActions={
        rightAction
          ? () => (
              <ActionPanel
                action={rightAction}
                align="flex-end"
                onPress={() => fire(rightAction)}
              />
            )
          : undefined
      }
      onSwipeableWillOpen={() => {
        Haptics.selectionAsync();
      }}
      onSwipeableOpen={(direction) => {
        if (!triggerOnOpen) return;
        const action = direction === "left" ? leftAction : rightAction;
        if (action) fire(action);
      }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  panelInner: {
    alignItems: "center",
    gap: 4,
  },
  panelLabel: {
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
  },
});
