import { useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, View, Pressable } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { expensesApi } from "../../src/lib/api";
import { useAuth } from "../../src/providers/AuthProvider";
import { SwipeableRow } from "../../src/components/SwipeableRow";
import { useTheme, useThemedStyles } from "../../src/theme";
import { ThemeTokens } from "../../src/theme/types";
import { Text, Badge, Button, EmptyState } from "../../src/components/ui";

type InboxStatus = "danger" | "info" | "warning" | "success";

function getInboxState(expense: { analysis_status?: string | null; review_status?: string | null }): {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  status: InboxStatus;
} {
  if (expense.analysis_status === "failed" || expense.review_status === "failed") {
    return { label: "Needs attention", icon: "alert-circle", status: "danger" };
  }
  if (expense.analysis_status === "processing" || expense.analysis_status === "queued" || expense.review_status === "pending") {
    return { label: "Processing", icon: "clock", status: "info" };
  }
  if (expense.review_status === "diff_found") {
    return { label: "Review changes", icon: "edit-3", status: "warning" };
  }
  return { label: "Ready to review", icon: "check-circle", status: "success" };
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tokens } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const statusColor: Record<InboxStatus, string> = {
    danger: tokens.color.danger,
    info: tokens.color.info,
    warning: tokens.color.warning,
    success: tokens.color.success,
  };

  const query = useQuery({
    queryKey: ["expenses", "inbox"],
    queryFn: expensesApi.getExpenses,
    enabled: Boolean(accessToken),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => expensesApi.acceptReview(id),
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: ["expenses", "inbox"] });
      const previous = queryClient.getQueryData(["expenses", "inbox"]);
      queryClient.setQueryData(["expenses", "inbox"], (old: any) =>
        old ? { ...old, expenses: old.expenses.filter((e: any) => e.id !== id) } : old
      );
      return { previous };
    },
    onError: (_err, _id, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["expenses", "inbox"], context.previous);
      }
    },
    onSettled: () => {
      setPendingId(null);
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => expensesApi.rejectReview(id),
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: ["expenses", "inbox"] });
      const previous = queryClient.getQueryData(["expenses", "inbox"]);
      queryClient.setQueryData(["expenses", "inbox"], (old: any) =>
        old ? { ...old, expenses: old.expenses.filter((e: any) => e.id !== id) } : old
      );
      return { previous };
    },
    onError: (_err, _id, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["expenses", "inbox"], context.previous);
      }
    },
    onSettled: () => {
      setPendingId(null);
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
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
  const reviewCount = items.filter((expense) => getInboxState(expense).label === "Review changes").length;

  const summaryStats: { value: number; label: string; color: string }[] = [
    { value: items.length, label: "In queue", color: tokens.color.info },
    { value: attentionCount, label: "Attention", color: tokens.color.danger },
    { value: processingCount, label: "Processing", color: tokens.color.warning },
    { value: reviewCount, label: "To review", color: tokens.color.success },
  ];

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
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="headingLg">Review queue</Text>
              <Text variant="bodyMd" color="textMuted" style={{ marginTop: 4 }}>
                Confirm drafts, OCR results, and receipts that need attention.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh review queue"
              style={[styles.refreshButton, query.isFetching && styles.buttonDisabled]}
              onPress={() => query.refetch()}
              disabled={query.isFetching}
            >
              <Feather name="rotate-cw" size={16} color={tokens.color.textMuted} />
            </Pressable>
          </View>

          <View style={styles.queueSummary}>
            {summaryStats.map((stat) => (
              <View
                key={stat.label}
                style={[styles.queueSummaryItem, { backgroundColor: stat.color + "0D", borderColor: stat.color + "26" }]}
              >
                <Text variant="headingLg" style={{ color: stat.color }}>{stat.value}</Text>
                <Text variant="caption" color="textMuted">{stat.label}</Text>
              </View>
            ))}
          </View>

          {reviewCount > 0 ? (
            <Button
              label={`Review ${reviewCount}`}
              fullWidth
              leftIcon={<Feather name="zap" size={16} color={tokens.color.onPrimary} />}
              onPress={() => router.push("/review" as never)}
            />
          ) : null}
        </View>

        {query.isLoading ? (
          <View style={styles.card}>
            <Text variant="bodyMd" color="textMuted">Loading mobile inbox...</Text>
          </View>
        ) : query.isError ? (
          <View style={styles.card}>
            <Text variant="headingMd">Review queue could not load</Text>
            <Text variant="bodyMd" color="textMuted">
              {query.error instanceof Error ? query.error.message : "Check your connection and try again."}
            </Text>
            <Button label="Try again" size="sm" onPress={() => query.refetch()} style={{ alignSelf: "flex-start", marginTop: 4 }} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.card}>
            <EmptyState
              icon={
                <View style={styles.emptyIconCircle}>
                  <Feather name="inbox" size={36} color={tokens.color.primary} />
                </View>
              }
              title="Nothing waiting right now"
              description="New receipt uploads and voice drafts will appear here as soon as they need review."
            />
          </View>
        ) : (
          items.map((item) => {
            const state = getInboxState(item);
            const isReviewable = item.review_status === "diff_found";
            const isActing = pendingId === item.id;

            return (
              <SwipeableRow
                key={item.id}
                disabled={!isReviewable}
                triggerOnOpen
                leftAction={
                  isReviewable
                    ? {
                        label: "Approve",
                        icon: "check",
                        color: tokens.color.success,
                        onTrigger: () => {
                          setPendingId(item.id);
                          approveMutation.mutate(item.id);
                        },
                      }
                    : undefined
                }
                rightAction={
                  isReviewable
                    ? {
                        label: "Reject",
                        icon: "x",
                        color: tokens.color.danger,
                        onTrigger: () => {
                          setPendingId(item.id);
                          rejectMutation.mutate(item.id);
                        },
                      }
                    : undefined
                }
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open expense ${item.vendor ?? item.category}`}
                  onPress={() => router.push(`/expense/${item.id}` as never)}
                  style={({ pressed }) => [styles.cardColumn, pressed && styles.cardPressed]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="headingLg" numberOfLines={1} adjustsFontSizeToFit>
                        {formatMoney(item.amount, item.currency)}
                      </Text>
                      <Text variant="bodyMd" color="textMuted" numberOfLines={1} style={{ marginTop: 2 }}>
                        {item.vendor ?? "Unknown vendor"}
                      </Text>
                    </View>
                    <Badge
                      label={state.label}
                      status={state.status}
                      appearance="soft"
                      leftIcon={<Feather name={state.icon} size={13} color={statusColor[state.status]} />}
                    />
                  </View>

                  <View style={styles.metaRow}>
                    <Text variant="bodyMd" color="textMuted" numberOfLines={1}>{item.category}</Text>
                    <Text variant="bodyMd" color="textMuted">{formatDateLabel(item.expense_date)}</Text>
                  </View>

                  <Text variant="bodySm" color="textSubtle">
                    Attachments: {item.attachments_count ?? 0} • Analysis: {item.analysis_status ?? "not_started"}
                  </Text>

                  {isReviewable ? (
                    <View style={styles.actionRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Approve expense"
                        onPress={(e) => {
                          e.stopPropagation();
                          setPendingId(item.id);
                          approveMutation.mutate(item.id);
                        }}
                        disabled={isActing}
                        style={[styles.approveBtn, isActing && styles.buttonDisabled]}
                      >
                        {isActing && approveMutation.isPending ? (
                          <ActivityIndicator size="small" color={tokens.color.onPrimary} />
                        ) : (
                          <Text variant="bodyMd" style={[styles.actionBtnText, { color: tokens.color.onPrimary }]}>Approve</Text>
                        )}
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Reject expense"
                        onPress={(e) => {
                          e.stopPropagation();
                          setPendingId(item.id);
                          rejectMutation.mutate(item.id);
                        }}
                        disabled={isActing}
                        style={[styles.rejectBtn, isActing && styles.buttonDisabled]}
                      >
                        {isActing && rejectMutation.isPending ? (
                          <ActivityIndicator size="small" color={tokens.color.onPrimary} />
                        ) : (
                          <Text variant="bodyMd" style={[styles.actionBtnText, { color: tokens.color.onPrimary }]}>Reject</Text>
                        )}
                      </Pressable>
                    </View>
                  ) : null}
                </Pressable>
              </SwipeableRow>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (t: ThemeTokens) => ({
  safeArea: { flex: 1, backgroundColor: t.color.background },
  screen: { flex: 1, backgroundColor: t.color.background },
  content: { padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: 120 },
  headerCard: {
    borderRadius: t.radii.xl,
    padding: t.spacing.lg,
    gap: t.spacing.md,
    backgroundColor: t.color.surface,
    ...t.shadow.soft,
  },
  headerTopRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
    gap: t.spacing.md,
  },
  refreshButton: {
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
  queueSummary: {
    flexDirection: "row" as const,
    gap: t.spacing.sm,
  },
  queueSummaryItem: {
    flex: 1,
    minHeight: 66,
    borderRadius: t.radii.lg,
    padding: t.spacing.sm,
    justifyContent: "center" as const,
    borderWidth: 1,
  },
  card: {
    borderRadius: t.radii.xl,
    padding: t.spacing.lg,
    gap: t.spacing.sm,
    backgroundColor: t.color.surface,
    ...t.shadow.soft,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: t.color.primaryMuted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  cardColumn: {
    borderRadius: t.radii.xl,
    padding: t.spacing.lg,
    gap: t.spacing.md,
    backgroundColor: t.color.surface,
    ...t.shadow.soft,
  },
  cardPressed: { opacity: 0.7 },
  actionRow: { flexDirection: "row" as const, gap: t.spacing.sm, marginTop: 4 },
  approveBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: t.radii.md,
    backgroundColor: t.color.primary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  rejectBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: t.radii.md,
    backgroundColor: t.color.danger,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  actionBtnText: {
    fontFamily: "Outfit_600SemiBold",
  },
  cardTopRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    justifyContent: "space-between" as const,
    gap: t.spacing.md,
  },
  metaRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
});
