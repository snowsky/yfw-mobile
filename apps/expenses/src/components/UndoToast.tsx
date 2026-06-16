import { Pressable, StyleSheet, Text } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type UndoToastProps = {
  visible: boolean;
  message: string;
  onUndo: () => void;
};

export function UndoToast({ visible, message, onUndo }: UndoToastProps) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInDown}
      exiting={FadeOutDown}
      style={[styles.toast, { bottom: insets.bottom + 90 }]}
    >
      <Text style={styles.message} numberOfLines={1}>
        {message}
      </Text>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={onUndo}>
        <Text style={styles.undo}>Undo</Text>
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
    borderRadius: 14,
    backgroundColor: "#0F172A",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  message: {
    flex: 1,
    color: "#ffffff",
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
  },
  undo: {
    color: "#34d399",
    fontFamily: "Outfit_700Bold",
    fontSize: 14,
  },
});
