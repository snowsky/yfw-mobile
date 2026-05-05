import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { expensesApi } from "../../src/lib/api";
import { useAuth } from "../../src/providers/AuthProvider";

const filters = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
] as const;

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

export default function TimelineScreen() {
  const { accessToken } = useAuth();
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]["key"]>("all");
  const query = useQuery({
    queryKey: ["expenses", "timeline"],
    queryFn: expensesApi.getExpenses,
    enabled: Boolean(accessToken),
  });

  const expenses = useMemo(() => {
    const all = query.data?.expenses ?? [];
    const now = new Date();

    return all.filter((expense) => {
      if (activeFilter === "all") return true;

      const expenseDate = new Date(`${expense.expense_date}T00:00:00`);
      const diffDays = Math.floor((now.getTime() - expenseDate.getTime()) / 86400000);

      if (activeFilter === "today") return diffDays === 0;
      if (activeFilter === "week") return diffDays >= 0 && diffDays < 7;
      if (activeFilter === "month") {
        return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
      }

      return true;
    });
  }, [activeFilter, query.data?.expenses]);

  const summary = useMemo(() => {
    const total = expenses.reduce((sum, expense) => sum + (expense.amount ?? 0), 0);
    return {
      total,
      count: expenses.length,
      average: expenses.length ? total / expenses.length : 0,
      currency: expenses[0]?.currency ?? "USD",
    };
  }, [expenses]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>Recent spending</Text>
              <Text style={styles.headerBody}>Track what was captured and spot anything missing.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh expenses"
              onPress={() => query.refetch()}
              disabled={query.isFetching}
              style={[styles.iconButton, query.isFetching && styles.buttonDisabled]}
            >
              <Feather name="rotate-cw" size={17} color="#334155" />
            </Pressable>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={styles.summaryValue}>{formatMoney(summary.total, summary.currency)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>Count</Text>
              <Text style={styles.summaryValue}>{summary.count}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryBlock}>
              <Text style={styles.summaryLabel}>Average</Text>
              <Text style={styles.summaryValue}>{formatMoney(summary.average, summary.currency)}</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {filters.map((filter) => {
              const active = filter.key === activeFilter;
              return (
                <Pressable
                  key={filter.key}
                  onPress={() => setActiveFilter(filter.key)}
                  style={[styles.filterPill, active ? styles.filterPillActive : styles.filterPillInactive]}
                >
                  <Text style={[styles.filterText, active ? styles.filterTextActive : styles.filterTextInactive]}>
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {query.isLoading ? (
          <View style={styles.messageCard}>
            <Text style={styles.emptyText}>Loading expenses...</Text>
          </View>
        ) : query.isError ? (
          <View style={styles.messageCard}>
            <Text style={styles.emptyTitle}>Expenses could not load</Text>
            <Text style={styles.emptyText}>
              {query.error instanceof Error ? query.error.message : "Pull to refresh or try again shortly."}
            </Text>
            <Pressable style={styles.retryButton} onPress={() => query.refetch()}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : expenses.length === 0 ? (
          <View style={styles.messageCard}>
            <Text style={styles.emptyTitle}>No expenses found</Text>
            <Text style={styles.emptyText}>Nothing matches this time window. Try another filter or capture a new expense.</Text>
          </View>
        ) : (
          expenses.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardMain}>
                <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
                  {formatMoney(item.amount, item.currency)}
                </Text>
                <Text style={styles.vendor} numberOfLines={1}>{item.vendor ?? "Unknown vendor"}</Text>
                <Text style={styles.category}>{item.category}</Text>
              </View>
              <View style={styles.rightMeta}>
                <Text style={styles.dateText}>{formatDateLabel(item.expense_date)}</Text>
                <Text style={styles.currencyText}>{item.currency ?? "USD"}</Text>
              </View>
            </View>
          ))
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
    gap: 12,
    backgroundColor: "#ffffff",
    shadowColor: "#cbd5e1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCopy: { flex: 1 },
  headerTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 22,
    color: "#0F172A",
  },
  headerBody: {
    marginTop: 4,
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
  },
  iconButton: {
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
  summaryRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  summaryBlock: {
    flex: 1,
    minHeight: 70,
    padding: 12,
    justifyContent: "center",
  },
  summaryDivider: {
    width: 1,
    backgroundColor: "#e2e8f0",
  },
  summaryLabel: {
    fontFamily: "Outfit_500Medium",
    fontSize: 12,
    color: "#64748B",
  },
  summaryValue: {
    marginTop: 4,
    fontFamily: "Outfit_700Bold",
    fontSize: 15,
    color: "#0F172A",
  },
  filterRow: {
    gap: 8,
    paddingRight: 4,
  },
  filterPill: {
    minHeight: 38,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  filterPillActive: {
    backgroundColor: "#059669",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  filterPillInactive: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 14,
  },
  filterTextActive: {
    color: "#ffffff",
  },
  filterTextInactive: {
    color: "#64748B",
  },
  card: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    shadowColor: "#cbd5e1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  messageCard: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: "#ffffff",
    gap: 8,
    shadowColor: "#cbd5e1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
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
  category: {
    marginTop: 8,
    fontFamily: "Outfit_600SemiBold",
    fontSize: 11,
    textTransform: "uppercase",
    color: "#94a3b8",
  },
  rightMeta: {
    alignItems: "flex-end",
    gap: 4,
    maxWidth: 122,
  },
  dateText: {
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
    color: "#64748B",
  },
  currencyText: {
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
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
