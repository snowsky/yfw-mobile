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
