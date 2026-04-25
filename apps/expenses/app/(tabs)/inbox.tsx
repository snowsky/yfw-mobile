import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { expensesApi } from "../../src/lib/api";
import { useAuth } from "../../src/providers/AuthProvider";

function getInboxState(expense: { analysis_status?: string | null; review_status?: string | null }) {
  if (expense.analysis_status === "failed" || expense.review_status === "failed") {
    return { label: "Needs attention", icon: "alert-circle", tone: "#ef4444" };
  }

  if (expense.analysis_status === "processing" || expense.analysis_status === "queued" || expense.review_status === "pending") {
    return { label: "Processing", icon: "clock", tone: "#0284c7" };
  }

  return { label: "Ready to review", icon: "check-circle", tone: "#059669" };
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

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.headerTitle}>Review queue</Text>
              <Text style={styles.headerBody}>
                OCR and voice drafts that still need a quick human pass.
              </Text>
            </View>
            <Pressable style={styles.refreshButton} onPress={() => query.refetch()} disabled={query.isFetching}>
              <Feather name="rotate-cw" size={16} color="#334155" />
            </Pressable>
          </View>
        </View>

        {query.isLoading ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Loading mobile inbox...</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyTitle}>Nothing waiting right now.</Text>
            <Text style={styles.emptyText}>New receipt uploads and voice drafts will appear here.</Text>
          </View>
        ) : (
          items.map((item) => {
            const state = getInboxState(item);

            return (
              <View key={item.id} style={styles.cardColumn}>
                <View style={styles.cardTopRow}>
                  <View>
                    <Text style={styles.amount}>{formatMoney(item.amount, item.currency)}</Text>
                    <Text style={styles.vendor}>{item.vendor ?? "Unknown vendor"}</Text>
                  </View>
                  <View style={styles.statusRow}>
                    <Feather name={state.icon as any} size={15} color={state.tone} />
                    <Text style={[styles.statusText, { color: state.tone }]}>{state.label}</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>{item.category}</Text>
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
    borderRadius: 28,
    padding: 18,
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
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  card: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: "#ffffff",
    shadowColor: "#cbd5e1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  cardColumn: {
    borderRadius: 28,
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
});
