import { useRef, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { expensesApi } from "../src/lib/api";
import { useAuth } from "../src/providers/AuthProvider";
import { SwipeCard, type SwipeCardHandle, type SwipeCardItem } from "../src/components/SwipeCard";
import { useTheme, useThemedStyles } from "../src/theme";
import { ThemeTokens } from "../src/theme/types";
import { Text, Button } from "../src/components/ui";

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
  const { tokens } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
          currency: e.currency ?? "USD",
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
          <ActivityIndicator color={tokens.color.primary} />
          <Text variant="bodyMd" color="textMuted">Loading review queue…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (total === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.centerWrap}>
          <Feather name="check-circle" size={44} color={tokens.color.primary} />
          <Text variant="headingXl">Nothing to review</Text>
          <Button label="Back to inbox" onPress={() => router.back()} />
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
          <Feather name="x" size={26} color={tokens.color.text} />
        </Pressable>
        <Text variant="headingSm">
          {Math.min(index + 1, total)} of {total}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {commitError ? (
        <View style={styles.errorBanner}>
          <Text variant="bodyMd" style={{ color: tokens.color.danger }}>{commitError}</Text>
        </View>
      ) : null}

      {isDone ? (
        <View style={styles.centerWrap}>
          <View style={styles.doneIconCircle}>
            <Feather name="check-circle" size={48} color={tokens.color.primary} />
          </View>
          <Text variant="headingXl">All caught up</Text>
          <Text variant="bodyLg" color="textMuted" center>
            Reviewed {decisions.length} · {approvedCount} approved, {rejectedCount} rejected
          </Text>
          <View style={styles.doneActions}>
            <Button
              label="Undo"
              variant="outline"
              onPress={handleUndo}
              disabled={decisions.length === 0}
              leftIcon={<Feather name="rotate-ccw" size={18} color={tokens.color.primary} />}
            />
            <Button label="Done" onPress={commitAndExit} loading={committing} />
          </View>
        </View>
      ) : (
        <>
          <View style={styles.stack}>
            {index + 1 < total ? (
              <View style={styles.peek} pointerEvents="none">
                <Text variant="headingLg" color="textSubtle" numberOfLines={1}>
                  {formatMoney(deck[index + 1].amount, deck[index + 1].currency)}
                </Text>
                <Text variant="bodyLg" color="textSubtle" numberOfLines={1}>
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
              <Feather name="x" size={26} color={tokens.color.danger} />
            </Pressable>
            <Pressable
              onPress={handleUndo}
              disabled={decisions.length === 0}
              accessibilityRole="button"
              accessibilityLabel="Undo last decision"
              style={[styles.circleBtnSm, decisions.length === 0 && styles.btnDisabled]}
            >
              <Feather name="rotate-ccw" size={20} color={tokens.color.text} />
            </Pressable>
            <Pressable
              onPress={() => topCardRef.current?.swipe("approve")}
              accessibilityRole="button"
              accessibilityLabel="Approve"
              style={[styles.circleBtn, styles.approveBtn]}
            >
              <Feather name="check" size={26} color={tokens.color.success} />
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (t: ThemeTokens) => ({
  safe: { flex: 1, backgroundColor: t.color.background },
  topBar: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: t.spacing.xl,
    paddingVertical: t.spacing.md,
  },
  centerWrap: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const, gap: t.spacing.md, padding: t.spacing.xl },
  doneIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: t.color.primaryMuted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: t.spacing.sm,
  },
  stack: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const },
  peek: {
    position: "absolute" as const,
    width: SCREEN_W - 64,
    minHeight: 340,
    borderRadius: t.radii["2xl"],
    backgroundColor: t.color.surface,
    padding: t.spacing.xl,
    justifyContent: "center" as const,
    gap: t.spacing.sm,
    transform: [{ scale: 0.94 }, { translateY: 18 }],
    ...t.shadow.soft,
  },
  actions: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: t.spacing.xl,
    paddingVertical: t.spacing.xl,
  },
  circleBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: t.color.surface,
    ...t.shadow.medium,
  },
  rejectBtn: { borderWidth: 2, borderColor: t.color.danger + "55" },
  approveBtn: { borderWidth: 2, borderColor: t.color.success + "55" },
  circleBtnSm: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  btnDisabled: { opacity: 0.4 },
  doneActions: { flexDirection: "row" as const, gap: t.spacing.md, marginTop: t.spacing.lg },
  errorBanner: {
    marginHorizontal: t.spacing.xl,
    marginBottom: t.spacing.sm,
    backgroundColor: t.color.danger + "1A",
    borderRadius: t.radii.md,
    padding: t.spacing.md,
  },
});
