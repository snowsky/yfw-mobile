# Card-Stack Inbox Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen Tinder-style reviewer for the Inbox — swipe right to Approve, left to Reject, with Undo — staging decisions locally and committing them to the server on exit.

**Architecture:** A new `SwipeCard` component (hand-rolled with the installed gesture-handler + reanimated) renders one draggable expense card. A new `review.tsx` route owns the deck snapshot, current index, staged decisions, completion summary, and commit-on-exit. The Inbox gains a "Review N" button that opens the route.

**Tech Stack:** React Native 0.81, expo-router 5, `react-native-gesture-handler` 2.28 (`Gesture.Pan/Tap`, `GestureDetector`), `react-native-reanimated` 4.x (shared values, `withTiming`/`withSpring`, `interpolate`, `runOnJS`), `expo-haptics`, `@tanstack/react-query`.

---

## Testing note

No unit-test harness exists (per CLAUDE.md). Each task gates on:
1. `npx tsc --noEmit` from `apps/expenses` — no errors.
2. A manual check (gesture/reanimated/haptics native modules are already built
   from prior work, so a JS reload is enough).

## File structure

| File | Responsibility | Action |
|------|----------------|--------|
| `apps/expenses/src/components/SwipeCard.tsx` | One draggable expense card: pan+fling, overlay APPROVE/REJECT labels, tap-to-detail, imperative `swipe()` | Create |
| `apps/expenses/app/review.tsx` | Full-screen reviewer: deck snapshot, index, staged decisions, peeking card, buttons, completion, commit-on-exit | Create |
| `app/review.tsx` (workspace root) | Re-export shim so root `expo run` resolves the route | Create |
| `apps/expenses/app/(tabs)/inbox.tsx` | "Review N" button → `router.push("/review")` | Modify |

---

## Task 1: `SwipeCard` component

**Files:**
- Create: `apps/expenses/src/components/SwipeCard.tsx`

- [ ] **Step 1: Create the component**

Create `apps/expenses/src/components/SwipeCard.tsx` with EXACTLY:

```tsx
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
```

- [ ] **Step 2: Verify types**

Run from `apps/expenses`:
```bash
npx tsc --noEmit
```
Expected: no errors. The reanimated APIs (`interpolate`, `Extrapolation`,
`runOnJS`, `withTiming`/`withSpring`) and gesture-handler `Gesture.Pan/Tap/Exclusive`
+ `GestureDetector` all resolve in the installed versions. If any genuinely does
not resolve, report BLOCKED with the exact error — do not cast with `any`.

- [ ] **Step 3: Commit**

```bash
git add apps/expenses/src/components/SwipeCard.tsx
git commit -m "feat(review): SwipeCard draggable expense card"
```

---

## Task 2: `review.tsx` screen + root shim

**Files:**
- Create: `apps/expenses/app/review.tsx`
- Create: `app/review.tsx` (workspace root shim)

- [ ] **Step 1: Create the screen**

Create `apps/expenses/app/review.tsx` with EXACTLY:

```tsx
import { useRef, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { expensesApi } from "../src/lib/api";
import { useAuth } from "../src/providers/AuthProvider";
import { SwipeCard, type SwipeCardHandle, type SwipeCardItem } from "../src/components/SwipeCard";

const { width: SCREEN_W } = Dimensions.get("window");

type Decision = { id: number; decision: "approve" | "reject" };

function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);
}

export default function ReviewScreen() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const topCardRef = useRef<SwipeCardHandle>(null);

  const query = useQuery({
    queryKey: ["expenses", "inbox"],
    queryFn: expensesApi.getExpenses,
    enabled: Boolean(accessToken),
  });

  const [deck, setDeck] = useState<SwipeCardItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  // Snapshot the reviewable deck once, when data first arrives, so the order
  // never reshuffles mid-review.
  if (deck === null && query.data) {
    setDeck(
      query.data.expenses
        .filter((e) => e.review_status === "diff_found")
        .map((e) => ({
          id: e.id,
          amount: e.amount,
          currency: e.currency,
          vendor: e.vendor,
          category: e.category,
          expense_date: e.expense_date,
        }))
    );
  }

  const total = deck?.length ?? 0;
  const approvedCount = decisions.filter((d) => d.decision === "approve").length;
  const rejectedCount = decisions.length - approvedCount;
  const isDone = deck !== null && index >= total;

  const handleDecision = (decision: "approve" | "reject") => {
    if (!deck || index >= deck.length) return;
    setDecisions((prev) => [...prev, { id: deck[index].id, decision }]);
    setIndex((i) => i + 1);
  };

  const handleUndo = () => {
    if (decisions.length === 0) return;
    setDecisions((prev) => prev.slice(0, -1));
    setIndex((i) => Math.max(0, i - 1));
  };

  const commitAndExit = async () => {
    if (committing) return;
    if (decisions.length === 0) {
      router.back();
      return;
    }
    setCommitting(true);
    setCommitError(null);
    const results = await Promise.allSettled(
      decisions.map((d) =>
        d.decision === "approve" ? expensesApi.acceptReview(d.id) : expensesApi.rejectReview(d.id)
      )
    );
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      setCommitting(false);
      setCommitError(`${failed} of ${decisions.length} couldn't be saved. They're still in your inbox.`);
      return;
    }
    router.back();
  };

  if (query.isLoading || deck === null) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.centerWrap}>
          <ActivityIndicator color="#059669" />
          <Text style={styles.centerText}>Loading review queue…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (total === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.centerWrap}>
          <Feather name="check-circle" size={44} color="#059669" />
          <Text style={styles.doneTitle}>Nothing to review</Text>
          <Pressable onPress={() => router.back()} style={[styles.btn, styles.btnPrimary]}>
            <Text style={styles.btnPrimaryText}>Back to inbox</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={commitAndExit}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close review"
        >
          <Feather name="x" size={26} color="#0f172a" />
        </Pressable>
        <Text style={styles.progress}>
          {Math.min(index + 1, total)} of {total}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {commitError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{commitError}</Text>
        </View>
      ) : null}

      {isDone ? (
        <View style={styles.centerWrap}>
          <Feather name="check-circle" size={48} color="#059669" />
          <Text style={styles.doneTitle}>All caught up</Text>
          <Text style={styles.doneSummary}>
            Reviewed {decisions.length} · {approvedCount} approved, {rejectedCount} rejected
          </Text>
          <View style={styles.doneActions}>
            <Pressable
              onPress={handleUndo}
              disabled={decisions.length === 0}
              accessibilityRole="button"
              accessibilityLabel="Undo last decision"
              style={[styles.btn, styles.btnGhost, decisions.length === 0 && styles.btnDisabled]}
            >
              <Feather name="rotate-ccw" size={18} color="#0f172a" />
              <Text style={styles.btnGhostText}>Undo</Text>
            </Pressable>
            <Pressable
              onPress={commitAndExit}
              disabled={committing}
              accessibilityRole="button"
              accessibilityLabel="Done"
              style={[styles.btn, styles.btnPrimary, committing && styles.btnDisabled]}
            >
              {committing ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.btnPrimaryText}>Done</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.stack}>
            {index + 1 < total ? (
              <View style={styles.peek} pointerEvents="none">
                <Text style={styles.peekAmount} numberOfLines={1}>
                  {formatMoney(deck[index + 1].amount, deck[index + 1].currency)}
                </Text>
                <Text style={styles.peekVendor} numberOfLines={1}>
                  {deck[index + 1].vendor ?? "Unknown vendor"}
                </Text>
              </View>
            ) : null}
            <SwipeCard
              key={deck[index].id}
              ref={topCardRef}
              item={deck[index]}
              onDecision={handleDecision}
              onOpenDetail={() => router.push(`/expense/${deck[index].id}` as never)}
            />
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={() => topCardRef.current?.swipe("reject")}
              accessibilityRole="button"
              accessibilityLabel="Reject"
              style={[styles.circleBtn, styles.rejectBtn]}
            >
              <Feather name="x" size={26} color="#dc2626" />
            </Pressable>
            <Pressable
              onPress={handleUndo}
              disabled={decisions.length === 0}
              accessibilityRole="button"
              accessibilityLabel="Undo last decision"
              style={[styles.circleBtnSm, decisions.length === 0 && styles.btnDisabled]}
            >
              <Feather name="rotate-ccw" size={20} color="#0f172a" />
            </Pressable>
            <Pressable
              onPress={() => topCardRef.current?.swipe("approve")}
              accessibilityRole="button"
              accessibilityLabel="Approve"
              style={[styles.circleBtn, styles.approveBtn]}
            >
              <Feather name="check" size={26} color="#059669" />
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  progress: { fontFamily: "Outfit_700Bold", fontSize: 16, color: "#0f172a" },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  centerText: { fontFamily: "Outfit_500Medium", fontSize: 14, color: "#64748b" },
  stack: { flex: 1, alignItems: "center", justifyContent: "center" },
  peek: {
    position: "absolute",
    width: SCREEN_W - 64,
    minHeight: 340,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    padding: 24,
    justifyContent: "center",
    gap: 8,
    transform: [{ scale: 0.94 }, { translateY: 18 }],
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  peekAmount: { fontFamily: "Outfit_700Bold", fontSize: 28, color: "#94a3b8" },
  peekVendor: { fontFamily: "Outfit_500Medium", fontSize: 16, color: "#cbd5e1" },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingVertical: 24,
  },
  circleBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  rejectBtn: { borderWidth: 2, borderColor: "#fecaca" },
  approveBtn: { borderWidth: 2, borderColor: "#bbf7d0" },
  circleBtnSm: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  btnDisabled: { opacity: 0.4 },
  doneTitle: { fontFamily: "Outfit_700Bold", fontSize: 24, color: "#0f172a" },
  doneSummary: { fontFamily: "Outfit_500Medium", fontSize: 15, color: "#64748b", textAlign: "center" },
  doneActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  btn: {
    minHeight: 50,
    paddingHorizontal: 24,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnPrimary: { backgroundColor: "#059669" },
  btnPrimaryText: { fontFamily: "Outfit_700Bold", fontSize: 16, color: "#ffffff" },
  btnGhost: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e2e8f0" },
  btnGhostText: { fontFamily: "Outfit_700Bold", fontSize: 16, color: "#0f172a" },
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 12,
  },
  errorText: { fontFamily: "Outfit_500Medium", fontSize: 14, color: "#b91c1c" },
});
```

> Note: the root `<Stack>` already sets `headerShown: false` globally
> (`apps/expenses/app/_layout.tsx`), so this screen needs no per-screen header
> config — it renders full-screen over the tabs when pushed.

- [ ] **Step 2: Create the workspace-root shim**

Create `app/review.tsx` (at the WORKSPACE ROOT, not under apps/) with EXACTLY:

```tsx
export { default } from "../apps/expenses/app/review";
```

- [ ] **Step 3: Verify types**

Run from `apps/expenses`:
```bash
npx tsc --noEmit
```
Expected: no errors. (`deck[index].amount` etc. come from the list schema where
`amount` is a number and `currency` a string, matching `SwipeCardItem`.)

- [ ] **Step 4: Commit**

```bash
git add apps/expenses/app/review.tsx app/review.tsx
git commit -m "feat(review): full-screen card-stack reviewer route with commit-on-exit"
```

---

## Task 3: Inbox "Review N" button

**Files:**
- Modify: `apps/expenses/app/(tabs)/inbox.tsx`

- [ ] **Step 1: Add the button after the queue summary**

In `apps/expenses/app/(tabs)/inbox.tsx`, find the `</View>` that closes the
`styles.queueSummary` block (the row of summary tiles, inside `styles.headerCard`).
Immediately AFTER that closing `</View>` and still INSIDE the `styles.headerCard`
`View`, insert:

```tsx
          {reviewCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Review ${reviewCount} ${reviewCount === 1 ? "expense" : "expenses"}`}
              style={styles.reviewAllButton}
              onPress={() => router.push("/review" as never)}
            >
              <Feather name="zap" size={16} color="#ffffff" />
              <Text style={styles.reviewAllText}>Review {reviewCount}</Text>
            </Pressable>
          ) : null}
```

(`router`, `reviewCount`, `Pressable`, `Feather`, and `Text` are already imported
and in scope in this file.)

- [ ] **Step 2: Add the button styles**

In the `StyleSheet.create({ ... })` at the bottom of the file, add these two keys
(e.g. after the `queueSummary` entry):

```tsx
  reviewAllButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#059669",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  reviewAllText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 15,
    color: "#ffffff",
  },
```

- [ ] **Step 3: Verify types**

Run from `apps/expenses`:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Manual check**

- Inbox with at least one "Review changes" (`diff_found`) item shows a green
  "Review N" button in the header card; with none, the button is absent.
- Tap it → the full-screen reviewer opens with the first card and a "1 of N"
  progress, plus a peeking card behind it (when N > 1).
- Swipe right → card flings off right, approves, next card appears; swipe left →
  flings left, rejects. The big ✓ / ✗ buttons do the same with animation.
- Undo steps back and restores the prior card (and works from the "All caught up"
  screen).
- Finish the deck → summary with correct approved/rejected counts; Done returns
  to the Inbox.
- Confirm via network logs that NO accept/reject request fires during swiping;
  all staged decisions fire only on Done / close (✕). After returning, the Inbox
  reflects the changes.
- Tap a card → opens `/expense/:id`; back returns to the reviewer mid-deck.

- [ ] **Step 5: Commit**

```bash
git add "apps/expenses/app/(tabs)/inbox.tsx"
git commit -m "feat(inbox): Review N button opens the card-stack reviewer"
```

---

## Final verification

- [ ] **From `apps/expenses`:**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Full manual smoke:** open reviewer from Inbox; swipe both directions;
  buttons; Undo (mid-deck and from completion); tap-to-detail and back; finish →
  Done commits; ✕ mid-deck commits partial; staged-not-immediate confirmed via
  network logs; Inbox updates after exit.

- [ ] **Confirm clean branch:**

```bash
git status
```
Expected: nothing uncommitted on `feat/card-stack-review`.

## Spec coverage check

- "Review N" entry button (only when reviewable items exist) → Task 3 ✅
- Full-screen route + root shim → Task 2 ✅
- Deck snapshot of `diff_found` items, no reshuffle → Task 2 (render-time snapshot guarded by `deck === null`) ✅
- Top card + peeking card, progress, Approve/Reject/Undo buttons → Task 2 ✅
- SwipeCard: pan+fling, threshold/velocity, overlay labels, rotation, imperative `swipe()`, tap-to-detail, haptic → Task 1 ✅
- Staged decisions; Undo pops; commit-on-exit via `Promise.allSettled` + one invalidate → Task 2 ✅
- Completion summary with counts + Done; Undo from completion → Task 2 ✅
- Partial-failure count surfaced (error banner, items remain) → Task 2 ✅
- Accessibility buttons + card label; decorative overlay labels hidden → Tasks 1 & 2 ✅
- Verification via tsc + manual (no test harness) → every task ✅
