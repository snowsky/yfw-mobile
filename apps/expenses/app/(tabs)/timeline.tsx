import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, View, Pressable } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { expensesApi } from "../../src/lib/api";
import { useAuth } from "../../src/providers/AuthProvider";
import { SwipeableRow } from "../../src/components/SwipeableRow";
import { UndoToast } from "../../src/components/UndoToast";
import { useTheme, useThemedStyles } from "../../src/theme";
import { ColorTokens } from "../../src/theme/types";
import { Text, Input, FilterChip, Button, Divider, Entrance } from "../../src/components/ui";
import { formatMoney, formatDate } from "../../src/lib/format";
import { queryKeys } from "../../src/lib/queryKeys";

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

// Map a free-text category to an icon + a color token key (resolved per theme).
function getCategoryMeta(category: string): { name: keyof typeof Feather.glyphMap; colorKey: keyof ColorTokens } {
  const name = category.toLowerCase();
  if (name.includes("food") || name.includes("meal") || name.includes("dining") || name.includes("restaurant") || name.includes("cafe")) {
    return { name: "coffee", colorKey: "catFood" };
  }
  if (name.includes("travel") || name.includes("flight") || name.includes("hotel") || name.includes("taxi") || name.includes("car") || name.includes("ride")) {
    return { name: "compass", colorKey: "catTravel" };
  }
  if (name.includes("office") || name.includes("supplies") || name.includes("stationery") || name.includes("furniture")) {
    return { name: "briefcase", colorKey: "catOffice" };
  }
  if (name.includes("software") || name.includes("saas") || name.includes("subscription") || name.includes("tech") || name.includes("cloud")) {
    return { name: "monitor", colorKey: "catTech" };
  }
  if (name.includes("utility") || name.includes("phone") || name.includes("internet") || name.includes("electric") || name.includes("power")) {
    return { name: "zap", colorKey: "catUtility" };
  }
  if (name.includes("marketing") || name.includes("ads") || name.includes("advert") || name.includes("promo")) {
    return { name: "volume-2", colorKey: "catMarketing" };
  }
  return { name: "tag", colorKey: "primary" };
}

export default function TimelineScreen() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const { tokens } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]["key"]>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const query = useQuery({
    queryKey: queryKeys.timeline,
    queryFn: expensesApi.getExpenses,
    enabled: Boolean(accessToken),
  });

  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<TimelineExpense | null>(null);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => expensesApi.deleteExpense(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.expenses }),
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
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => query.refetch()}
            tintColor={tokens.color.primary}
            colors={[tokens.color.primary]}
          />
        }
      >
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerCopy}>
              <Text variant="headingLg">Recent spending</Text>
              <Text variant="bodyMd" color="textMuted" style={{ marginTop: 4 }}>
                Track what was captured and spot anything missing.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh expenses"
              onPress={() => query.refetch()}
              disabled={query.isFetching}
              style={[styles.iconButton, query.isFetching && styles.buttonDisabled]}
            >
              <Feather name="rotate-cw" size={17} color={tokens.color.textMuted} />
            </Pressable>
          </View>

          <Input
            placeholder="Search by vendor or category..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />

          <View style={styles.summaryRow}>
            <View style={styles.summaryBlock}>
              <Text variant="bodySm" color="textMuted">Total</Text>
              <Text variant="headingSm" style={{ marginTop: 4 }}>{formatMoney(summary.total, summary.currency)}</Text>
            </View>
            <Divider vertical />
            <View style={styles.summaryBlock}>
              <Text variant="bodySm" color="textMuted">Count</Text>
              <Text variant="headingSm" style={{ marginTop: 4 }}>{summary.count}</Text>
            </View>
            <Divider vertical />
            <View style={styles.summaryBlock}>
              <Text variant="bodySm" color="textMuted">Average</Text>
              <Text variant="headingSm" style={{ marginTop: 4 }}>{formatMoney(summary.average, summary.currency)}</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {filters.map((filter) => (
              <FilterChip
                key={filter.key}
                label={filter.label}
                active={filter.key === activeFilter}
                onPress={() => setActiveFilter(filter.key)}
              />
            ))}
          </ScrollView>
        </View>

        {query.isLoading ? (
          <View style={styles.messageCard}>
            <Text variant="bodyMd" color="textMuted">Loading expenses...</Text>
          </View>
        ) : query.isError ? (
          <View style={styles.messageCard}>
            <Text variant="headingMd">Expenses could not load</Text>
            <Text variant="bodyMd" color="textMuted">
              {query.error instanceof Error ? query.error.message : "Pull to refresh or try again shortly."}
            </Text>
            <Button label="Try again" size="sm" onPress={() => query.refetch()} style={{ alignSelf: "flex-start", marginTop: 4 }} />
          </View>
        ) : expenses.length === 0 ? (
          <View style={styles.messageCard}>
            <Text variant="headingMd">No expenses found</Text>
            <Text variant="bodyMd" color="textMuted">Nothing matches this time window. Try another filter or capture a new expense.</Text>
          </View>
        ) : (
          expenses
            .filter((item) => item.id !== pendingDelete?.id)
            .map((item, i) => {
              const meta = getCategoryMeta(item.category);
              const catColor = tokens.color[meta.colorKey];
              return (
                <Entrance key={item.id} index={i}>
                <SwipeableRow
                  rightAction={{
                    label: "Delete",
                    icon: "trash-2",
                    color: tokens.color.danger,
                    onTrigger: () => requestDelete(item),
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open expense ${item.vendor ?? item.category}`}
                    onPress={() => router.push(`/expense/${item.id}` as never)}
                    style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                  >
                    <View style={[styles.categoryIconCircle, { backgroundColor: catColor + "14" }]}>
                      <Feather name={meta.name} size={18} color={catColor} />
                    </View>
                    <View style={styles.cardMain}>
                      <View style={styles.cardMainHeader}>
                        <Text variant="bodyLg" style={styles.vendor} numberOfLines={1}>{item.vendor ?? "Unknown vendor"}</Text>
                        <Text variant="headingMd" numberOfLines={1} adjustsFontSizeToFit>
                          {formatMoney(item.amount, item.currency)}
                        </Text>
                      </View>
                      <View style={styles.cardMainFooter}>
                        <Text variant="bodySm" color="textSubtle">{item.category}</Text>
                        <Text variant="bodySm" color="textMuted">{formatDate(item.expense_date)}</Text>
                      </View>
                    </View>
                  </Pressable>
                </SwipeableRow>
                </Entrance>
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

const makeStyles = (t: import("../../src/theme/types").ThemeTokens) => ({
  safeArea: { flex: 1, backgroundColor: t.color.background },
  screen: { flex: 1, backgroundColor: t.color.background },
  content: { padding: t.spacing.lg, gap: t.spacing.md, paddingBottom: 120 },
  headerCard: {
    borderRadius: t.radii.xl,
    padding: t.spacing.lg,
    marginBottom: t.spacing.xs,
    gap: t.spacing.md,
    backgroundColor: t.color.surface,
    ...t.shadow.soft,
  },
  headerTopRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    justifyContent: "space-between" as const,
    gap: t.spacing.md,
  },
  headerCopy: { flex: 1 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: t.radii.md,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: t.color.surfaceMuted,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  buttonDisabled: { opacity: 0.55 },
  summaryRow: {
    flexDirection: "row" as const,
    alignItems: "stretch" as const,
    borderRadius: t.radii.lg,
    backgroundColor: t.color.surfaceMuted,
    borderWidth: 1,
    borderColor: t.color.border,
    overflow: "hidden" as const,
  },
  summaryBlock: {
    flex: 1,
    minHeight: 70,
    padding: t.spacing.md,
    justifyContent: "center" as const,
  },
  filterRow: {
    gap: t.spacing.sm,
    paddingRight: 4,
  },
  card: {
    borderRadius: t.radii.lg,
    padding: t.spacing.lg,
    backgroundColor: t.color.surface,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    ...t.shadow.soft,
  },
  cardPressed: { opacity: 0.85 },
  categoryIconCircle: {
    width: 38,
    height: 38,
    borderRadius: t.radii.md,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginRight: t.spacing.md,
  },
  cardMain: { flex: 1, minWidth: 0 },
  cardMainHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "baseline" as const,
    gap: t.spacing.sm,
  },
  cardMainFooter: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginTop: 4,
  },
  vendor: { flex: 1 },
  messageCard: {
    borderRadius: t.radii.xl,
    padding: t.spacing.lg,
    backgroundColor: t.color.surface,
    gap: t.spacing.sm,
    ...t.shadow.soft,
  },
});
