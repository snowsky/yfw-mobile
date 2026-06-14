import { forwardRef, useImperativeHandle } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";

const { width: SCREEN_W } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_W * 0.35;

export type SwipeCardItem = {
  id: number;
  amount: number;
  currency: string;
  vendor?: string | null;
  category: string;
  expense_date: string;
};

export type SwipeCardHandle = { swipe: (decision: "approve" | "reject") => void };

type SwipeCardProps = {
  item: SwipeCardItem;
  onDecision: (decision: "approve" | "reject") => void;
  onOpenDetail: () => void;
};

function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);
}

function formatDateLabel(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateString}T00:00:00`));
}

export const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(function SwipeCard(
  { item, onDecision, onOpenDetail },
  ref
) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const onSwipeComplete = (decision: "approve" | "reject") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onDecision(decision);
  };

  // Runs on the JS thread: sets the shared value (schedules the timing on UI).
  const animateOut = (direction: 1 | -1) => {
    const decision: "approve" | "reject" = direction > 0 ? "approve" : "reject";
    translateX.value = withTiming(direction * SCREEN_W * 1.5, { duration: 250 }, (finished) => {
      if (finished) runOnJS(onSwipeComplete)(decision);
    });
  };

  useImperativeHandle(ref, () => ({
    swipe: (decision) => animateOut(decision === "approve" ? 1 : -1),
  }));

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (Math.abs(translateX.value) > SWIPE_THRESHOLD || Math.abs(e.velocityX) > 800) {
        runOnJS(animateOut)(translateX.value > 0 ? 1 : -1);
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const tap = Gesture.Tap()
    .maxDistance(10)
    .onEnd(() => {
      runOnJS(onOpenDetail)();
    });

  const gesture = Gesture.Exclusive(pan, tap);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      {
        rotateZ: `${interpolate(
          translateX.value,
          [-SCREEN_W, SCREEN_W],
          [-10, 10],
          Extrapolation.CLAMP
        )}deg`,
      },
    ],
  }));

  const approveStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));

  const rejectStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.card, cardStyle]}
        accessibilityLabel={`Expense ${formatMoney(item.amount, item.currency)}, ${
          item.vendor ?? "unknown vendor"
        }, ${item.category}, ${formatDateLabel(item.expense_date)}`}
      >
        <Animated.View
          style={[styles.badge, styles.badgeApprove, approveStyle]}
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={styles.badgeApproveText}>APPROVE</Text>
        </Animated.View>
        <Animated.View
          style={[styles.badge, styles.badgeReject, rejectStyle]}
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={styles.badgeRejectText}>REJECT</Text>
        </Animated.View>

        <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
          {formatMoney(item.amount, item.currency)}
        </Text>
        <Text style={styles.vendor} numberOfLines={1}>
          {item.vendor ?? "Unknown vendor"}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{item.category}</Text>
          <Text style={styles.metaText}>{formatDateLabel(item.expense_date)}</Text>
        </View>
        <View style={styles.reviewPill}>
          <Feather name="edit-3" size={14} color="#d97706" />
          <Text style={styles.reviewPillText}>Changes detected — swipe to decide</Text>
        </View>
        <Text style={styles.hint}>Swipe right to approve · left to reject · tap for details</Text>
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  card: {
    width: SCREEN_W - 48,
    minHeight: 360,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    padding: 24,
    gap: 12,
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  badge: {
    position: "absolute",
    top: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 3,
  },
  badgeApprove: { right: 24, borderColor: "#059669", transform: [{ rotate: "12deg" }] },
  badgeReject: { left: 24, borderColor: "#dc2626", transform: [{ rotate: "-12deg" }] },
  badgeApproveText: { fontFamily: "Outfit_700Bold", fontSize: 20, color: "#059669" },
  badgeRejectText: { fontFamily: "Outfit_700Bold", fontSize: 20, color: "#dc2626" },
  amount: { fontFamily: "Outfit_700Bold", fontSize: 40, color: "#0F172A" },
  vendor: { fontFamily: "Outfit_600SemiBold", fontSize: 18, color: "#475569" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  metaText: { fontFamily: "Outfit_500Medium", fontSize: 14, color: "#64748b" },
  reviewPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#fffbeb",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  reviewPillText: { fontFamily: "Outfit_600SemiBold", fontSize: 13, color: "#d97706" },
  hint: { fontFamily: "Outfit_400Regular", fontSize: 12, color: "#94a3b8", marginTop: 12 },
});
