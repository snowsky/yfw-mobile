import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { expensesApi } from "../../src/lib/api";
import { useAuth } from "../../src/providers/AuthProvider";

function getInboxState(expense: { analysis_status?: string | null; review_status?: string | null }) {
  if (expense.analysis_status === "failed" || expense.review_status === "failed") {
    return { label: "Needs attention", icon: "alert-circle", tone: "#dc2626", bg: "#fef2f2" };
  }

  if (expense.analysis_status === "processing" || expense.analysis_status === "queued" || expense.review_status === "pending") {
    return { label: "Processing", icon: "clock", tone: "#0284c7", bg: "#eff6ff" };
  }

  return { label: "Ready to review", icon: "check-circle", tone: "#059669", bg: "#ecfdf5" };
}

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
  }).format(new Date(`${dateString}T00:00:00`));
}

export default function InboxScreen() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ["expenses", "inbox"],
    queryFn: expensesApi.getExpenses,
    enabled: Boolean(accessToken),
  });

  const items = useMemo(
    () =>
      (query.data?.expenses ?? []).filter((expense) =>
        expense.attachments_count ||
        expense.analysis_status === "queued" ||
        expense.analysis_status === "processing" ||
        expense.analysis_status === "failed" ||
        expense.review_status === "pending" ||
        expense.review_status === "diff_found"
      ),
    [query.data?.expenses]
  );

  const attentionCount = items.filter((expense) => getInboxState(expense).label === "Needs attention").length;
  const processingCount = items.filter((expense) => getInboxState(expense).label === "Processing").length;

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>Review queue</Text>
              <Text style={styles.headerBody}>Confirm drafts, OCR results, and receipts that need attention.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh review queue"
              style={[styles.refreshButton, query.isFetching && styles.buttonDisabled]}
              onPress={() => query.refetch()}
              disabled={query.isFetching}
            >
              <Feather name="rotate-cw" size={16} color="#334155" />
            </Pressable>
          </View>
          <View style={styles.queueSummary}>
            <View style={styles.queueSummaryItem}>
              <Text style={styles.summaryValue}>{items.length}</Text>
              <Text style={styles.summaryLabel}>In queue</Text>
            </View>
            <View style={styles.queueSummaryItem}>
              <Text style={styles.summaryValue}>{attentionCount}</Text>
              <Text style={styles.summaryLabel}>Need attention</Text>
            </View>
            <View style={styles.queueSummaryItem}>
              <Text style={styles.summaryValue}>{processingCount}</Text>
              <Text style={styles.summaryLabel}>Processing</Text>
            </View>
          </View>
        </View>

        {query.isLoading ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Loading mobile inbox...</Text>
          </View>
        ) : query.isError ? (
          <View style={styles.card}>
            <Text style={styles.emptyTitle}>Review queue could not load</Text>
            <Text style={styles.emptyText}>
              {query.error instanceof Error ? query.error.message : "Check your connection and try again."}
            </Text>
            <Pressable style={styles.retryButton} onPress={() => query.refetch()}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyTitle}>Nothing waiting right now.</Text>
            <Text style={styles.emptyText}>New receipt uploads and voice drafts will appear here as soon as they need review.</Text>
          </View>
        ) : (
          items.map((item) => {
            const state = getInboxState(item);

            return (
              <View key={item.id} style={styles.cardColumn}>
                <View style={styles.cardTopRow}>
                  <View style={styles.cardMain}>
                    <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
                      {formatMoney(item.amount, item.currency)}
                    </Text>
                    <Text style={styles.vendor} numberOfLines={1}>{item.vendor ?? "Unknown vendor"}</Text>
                  </View>
                  <View style={[styles.statusRow, { backgroundColor: state.bg }]}>
                    <Feather name={state.icon as any} size={15} color={state.tone} />
                    <Text style={[styles.statusText, { color: state.tone }]}>{state.label}</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaText} numberOfLines={1}>{item.category}</Text>
                  <Text style={styles.metaText}>{formatDateLabel(item.expense_date)}</Text>
                </View>

                <Text style={styles.detailText}>
                  Attachments: {item.attachments_count ?? 0} • Analysis: {item.analysis_status ?? "not_started"}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  screen: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 16, gap: 16 },
  headerCard: {
    borderRadius: 18,
    padding: 18,
    gap: 14,
    backgroundColor: "#ffffff",
    shadowColor: "#cbd5e1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 22,
    color: "#0F172A",
  },
  headerBody: {
    marginTop: 6,
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  queueSummary: {
    flexDirection: "row",
    gap: 8,
  },
  queueSummaryItem: {
    flex: 1,
    minHeight: 66,
    borderRadius: 14,
    padding: 10,
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  summaryValue: {
    fontFamily: "Outfit_700Bold",
    fontSize: 20,
    color: "#0F172A",
  },
  summaryLabel: {
    marginTop: 2,
    fontFamily: "Outfit_500Medium",
    fontSize: 11,
    color: "#64748B",
  },
  card: {
    borderRadius: 18,
    padding: 18,
    gap: 8,
    backgroundColor: "#ffffff",
    shadowColor: "#cbd5e1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  cardColumn: {
    borderRadius: 18,
    padding: 18,
    gap: 12,
    backgroundColor: "#ffffff",
    shadowColor: "#cbd5e1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
  },
  amount: {
    fontFamily: "Outfit_700Bold",
    fontSize: 24,
    color: "#0F172A",
  },
  vendor: {
    marginTop: 2,
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
    color: "#475569",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 12,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaText: {
    flexShrink: 1,
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
    color: "#64748B",
  },
  detailText: {
    fontFamily: "Outfit_400Regular",
    fontSize: 13,
    lineHeight: 20,
    color: "#94a3b8",
  },
  emptyTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 18,
    color: "#0F172A",
  },
  emptyText: {
    marginTop: 4,
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
  },
  retryButton: {
    alignSelf: "flex-start",
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#059669",
  },
  retryText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 14,
    color: "#ffffff",
  },
});
