import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable, TextInput } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { expensesApi } from "../../src/lib/api";
import { useAuth } from "../../src/providers/AuthProvider";
import { SwipeableRow } from "../../src/components/SwipeableRow";
import { UndoToast } from "../../src/components/UndoToast";

// The list query yields the *input* shape of the expense-list schema (e.g.
// `currency` is optional because the zod schema defaults it), which is wider
// than the exported `ExpenseListItem` output type. Derive the row item type
// from the query result so state/handlers stay type-safe without `any`.
type TimelineExpense = NonNullable<
  Awaited<ReturnType<typeof expensesApi.getExpenses>>["expenses"]
>[number];

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

function getCategoryIcon(category: string) {
  const name = category.toLowerCase();
  if (name.includes("food") || name.includes("meal") || name.includes("dining") || name.includes("restaurant") || name.includes("cafe")) {
    return { name: "coffee" as const, color: "#d97706", bg: "rgba(217, 119, 6, 0.08)" };
  }
  if (name.includes("travel") || name.includes("flight") || name.includes("hotel") || name.includes("taxi") || name.includes("car") || name.includes("ride")) {
    return { name: "compass" as const, color: "#2563eb", bg: "rgba(37, 99, 235, 0.08)" };
  }
  if (name.includes("office") || name.includes("supplies") || name.includes("stationery") || name.includes("furniture")) {
    return { name: "briefcase" as const, color: "#7c3aed", bg: "rgba(124, 58, 237, 0.08)" };
  }
  if (name.includes("software") || name.includes("saas") || name.includes("subscription") || name.includes("tech") || name.includes("cloud")) {
    return { name: "monitor" as const, color: "#0891b2", bg: "rgba(8, 145, 178, 0.08)" };
  }
  if (name.includes("utility") || name.includes("phone") || name.includes("internet") || name.includes("electric") || name.includes("power")) {
    return { name: "zap" as const, color: "#ca8a04", bg: "rgba(202, 138, 4, 0.08)" };
  }
  if (name.includes("marketing") || name.includes("ads") || name.includes("advert") || name.includes("promo")) {
    return { name: "megaphone" as const, color: "#db2777", bg: "rgba(219, 39, 119, 0.08)" };
  }
  return { name: "tag" as const, color: "#059669", bg: "rgba(5, 150, 105, 0.08)" };
}

export default function TimelineScreen() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]["key"]>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const query = useQuery({
    queryKey: ["expenses", "timeline"],
    queryFn: expensesApi.getExpenses,
    enabled: Boolean(accessToken),
  });

  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<TimelineExpense | null>(null);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => expensesApi.deleteExpense(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const commitDelete = (item: TimelineExpense) => {
    deleteMutation.mutate(item.id);
  };

  const requestDelete = (item: TimelineExpense) => {
    // If a delete is already pending, commit it now before starting a new one.
    if (pendingDelete && deleteTimer.current) {
      clearTimeout(deleteTimer.current);
      commitDelete(pendingDelete);
    }
    setPendingDelete(item);
    deleteTimer.current = setTimeout(() => {
      commitDelete(item);
      deleteTimer.current = null;
      setPendingDelete(null);
    }, 4000);
  };

  const undoDelete = () => {
    if (deleteTimer.current) {
      clearTimeout(deleteTimer.current);
      deleteTimer.current = null;
    }
    setPendingDelete(null);
  };

  useEffect(() => {
    return () => {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
    };
  }, []);

  const expenses = useMemo(() => {
    const all = query.data?.expenses ?? [];
    const now = new Date();
    const cleanSearch = searchQuery.toLowerCase().trim();

    return all.filter((expense) => {
      // 1. Search query filter
      if (cleanSearch) {
        const vendor = (expense.vendor ?? "").toLowerCase();
        const category = (expense.category ?? "").toLowerCase();
        if (!vendor.includes(cleanSearch) && !category.includes(cleanSearch)) {
          return false;
        }
      }

      // 2. Date window filter
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
  }, [activeFilter, searchQuery, query.data?.expenses]);

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
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => query.refetch()}
            tintColor="#059669"
            colors={["#059669"]}
          />
        }
      >
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
          <View style={styles.searchBar}>
            <Feather name="search" size={16} color="#64748B" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by vendor or category..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")} style={styles.searchClear} hitSlop={10}>
                <Feather name="x" size={14} color="#64748B" />
              </Pressable>
            ) : null}
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
          expenses
            .filter((item) => item.id !== pendingDelete?.id)
            .map((item) => {
              const catIcon = getCategoryIcon(item.category);
              return (
                <SwipeableRow
                  key={item.id}
                  rightAction={{
                    label: "Delete",
                    icon: "trash-2",
                    color: "#dc2626",
                    onTrigger: () => requestDelete(item),
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open expense ${item.vendor ?? item.category}`}
                    onPress={() => router.push(`/expense/${item.id}` as never)}
                    style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                  >
                    <View style={[styles.categoryIconCircle, { backgroundColor: catIcon.bg }]}>
                      <Feather name={catIcon.name as any} size={18} color={catIcon.color} />
                    </View>
                    <View style={styles.cardMain}>
                      <View style={styles.cardMainHeader}>
                        <Text style={styles.vendor} numberOfLines={1}>{item.vendor ?? "Unknown vendor"}</Text>
                        <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
                          {formatMoney(item.amount, item.currency)}
                        </Text>
                      </View>
                      <View style={styles.cardMainFooter}>
                        <Text style={styles.categoryText}>{item.category}</Text>
                        <Text style={styles.dateText}>{formatDateLabel(item.expense_date)}</Text>
                      </View>
                    </View>
                  </Pressable>
                </SwipeableRow>
              );
            })
        )}
      </ScrollView>
      <UndoToast
        visible={Boolean(pendingDelete)}
        message="Expense deleted"
        onUndo={undoDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  screen: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 16, gap: 16, paddingBottom: 120 },
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    color: "#0F172A",
    height: "100%",
    padding: 0,
  },
  searchClear: {
    padding: 4,
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
    padding: 16,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#cbd5e1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPressed: { opacity: 0.7 },
  categoryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
  },
  cardMainHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
  },
  cardMainFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  amount: {
    fontFamily: "Outfit_700Bold",
    fontSize: 18,
    color: "#0F172A",
  },
  vendor: {
    flex: 1,
    fontFamily: "Outfit_600SemiBold",
    fontSize: 15,
    color: "#0F172A",
  },
  categoryText: {
    fontFamily: "Outfit_500Medium",
    fontSize: 13,
    color: "#94a3b8",
  },
  dateText: {
    fontFamily: "Outfit_400Regular",
    fontSize: 13,
    color: "#64748B",
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
