import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
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

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Recent spending</Text>
          <Text style={styles.headerBody}>
            Keep the mobile view scannable: amount first, details second.
          </Text>
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
          <View style={styles.card}>
            <Text style={styles.emptyText}>Loading expenses...</Text>
          </View>
        ) : expenses.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyTitle}>No expenses found</Text>
            <Text style={styles.emptyText}>Nothing matches this time window.</Text>
          </View>
        ) : (
          expenses.map((item) => (
            <View key={item.id} style={styles.card}>
              <View>
                <Text style={styles.amount}>{formatMoney(item.amount, item.currency)}</Text>
                <Text style={styles.vendor}>{item.vendor ?? "Unknown vendor"}</Text>
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
  headerTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 22,
    color: "#0F172A",
  },
  headerBody: {
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
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
    borderRadius: 28,
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
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#94a3b8",
  },
  rightMeta: {
    alignItems: "flex-end",
    gap: 4,
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
});
