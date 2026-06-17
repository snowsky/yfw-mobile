import { Pressable, StyleSheet, Text } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme";

type UndoToastProps = {
  visible: boolean;
  message: string;
  onUndo: () => void;
};

export function UndoToast({ visible, message, onUndo }: UndoToastProps) {
  const insets = useSafeAreaInsets();
  const { tokens, scheme } = useTheme();
  if (!visible) return null;

  // High-contrast surface against the screen: ink in light, raised charcoal in dark.
  const toastBg = scheme === "dark" ? tokens.color.surfaceMuted : tokens.color.text;
  const messageColor = scheme === "dark" ? tokens.color.text : tokens.color.onPrimary;

  return (
    <Animated.View
      entering={FadeInDown}
      exiting={FadeOutDown}
      style={[
        styles.toast,
        { bottom: insets.bottom + 90, backgroundColor: toastBg, borderRadius: tokens.radii.lg, ...tokens.shadow.strong },
      ]}
    >
      <Text style={[styles.message, { color: messageColor }]} numberOfLines={1}>
        {message}
      </Text>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={onUndo}>
        <Text style={[styles.undo, { color: tokens.color.primary }]}>Undo</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  message: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  undo: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
});
