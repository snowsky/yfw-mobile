import { Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { expensesApi } from "../../src/lib/api";
import { queryKeys } from "../../src/lib/queryKeys";
import { useAuth } from "../../src/providers/AuthProvider";
import { useTheme, useThemedStyles } from "../../src/theme";
import { ThemeTokens, ColorTokens } from "../../src/theme/types";
import { Screen, Card, MetricCard, Text } from "../../src/components/ui";

function asCurrency(value: number | undefined, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

// Distinct accent token keys cycled across breakdown bars.
const BAR_KEYS: (keyof ColorTokens)[] = ["primary", "info", "catOffice", "warning", "catTech"];

export default function InsightsScreen() {
  const { accessToken } = useAuth();
  const { tokens } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const query = useQuery({
    queryKey: queryKeys.insights,
    queryFn: expensesApi.getSummary,
    enabled: Boolean(accessToken),
  });

  const current = query.data?.current_period;
  const previous = query.data?.previous_period;
  const change = query.data?.changes?.total_amount_percent ?? 0;
  const categoryBreakdown = (query.data?.category_breakdown ?? []).slice(0, 5);
  const changeIsIncrease = change > 0;
  const changeStatus: "success" | "danger" = changeIsIncrease ? "danger" : "success";

  const cards: {
    title: string;
    value: string;
    detail: string;
    icon: keyof typeof Feather.glyphMap;
    iconColor: string;
    changeStatus?: "success" | "danger" | "neutral";
  }[] = [
    {
      title: "This month",
      value: asCurrency(current?.total_amount),
      detail: `${current?.count ?? 0} expenses`,
      icon: "credit-card",
      iconColor: tokens.color.primary,
    },
    {
      title: "Previous month",
      value: asCurrency(previous?.total_amount),
      detail: `${previous?.count ?? 0} expenses`,
      icon: "calendar",
      iconColor: tokens.color.textMuted,
    },
    {
      title: "Change",
      value: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
      detail: "vs previous period",
      icon: change > 0 ? "trending-up" : "trending-down",
      iconColor: changeIsIncrease ? tokens.color.danger : tokens.color.success,
      changeStatus,
    },
  ];

    const changeAccent = changeIsIncrease ? tokens.color.danger : tokens.color.success;

  return (
    <Screen scroll contentContainerStyle={{ gap: tokens.spacing.lg }}>
      <View style={styles.heroCard}>
        <Text variant="bodySm" color="textMuted">This month</Text>
        <Text variant="display" color="primary">{asCurrency(current?.total_amount)}</Text>
        <View style={styles.heroMetaRow}>
          <Text variant="bodyLg" color="textMuted">{current?.count ?? 0} expenses</Text>
          <View style={[styles.changePill, { backgroundColor: changeAccent + "1A" }]}>
            <Feather name={changeIsIncrease ? "trending-up" : "trending-down"} size={14} color={changeAccent} />
            <Text variant="bodySm" style={{ color: changeAccent }}>
              {change >= 0 ? "+" : ""}{change.toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>

      {query.isLoading ? (
        <Card>
          <Text variant="bodyMd" color="textMuted">Loading monthly summary...</Text>
        </Card>
      ) : query.isError ? (
        <Card style={styles.errorCard}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="headingMd">Insights could not load</Text>
            <Text variant="bodyMd" color="textMuted">
              {query.error instanceof Error ? query.error.message : "Try again shortly."}
            </Text>
          </View>
          <Pressable style={styles.iconButton} onPress={() => query.refetch()}>
            <Feather name="rotate-cw" size={17} color={tokens.color.textMuted} />
          </Pressable>
        </Card>
      ) : (
        cards.map((card) => (
          <MetricCard
            key={card.title}
            label={card.title}
            value={card.value}
            change={card.detail}
            changeStatus={card.changeStatus ?? "neutral"}
            icon={
              <View style={[styles.metricIconWrap, { backgroundColor: card.iconColor + "1A" }]}>
                <Feather name={card.icon} size={20} color={card.iconColor} />
              </View>
            }
          />
        ))
      )}

      <Card style={{ gap: tokens.spacing.md }}>
        <View>
          <Text variant="headingLg">Category breakdown</Text>
          <Text variant="bodyMd" color="textMuted">Your top categories for the current period.</Text>
        </View>

        {categoryBreakdown.length === 0 && !query.isLoading ? (
          <Text variant="bodyMd" color="textMuted">No category data yet. Capture expenses to build this view.</Text>
        ) : (
          categoryBreakdown.map((category, idx) => {
            const barColor = tokens.color[BAR_KEYS[idx % BAR_KEYS.length]];
            return (
              <View key={category.category} style={styles.categoryRow}>
                <View style={styles.categoryRowTop}>
                  <Text variant="bodyMd" style={{ flex: 1, marginRight: tokens.spacing.md }} numberOfLines={1}>{category.category}</Text>
                  <Text variant="headingSm">{asCurrency(category.total_amount)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.min(100, Number(category.percentage || 0))}%`,
                        backgroundColor: barColor,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })
        )}
      </Card>
    </Screen>
  );
}

const makeStyles = (t: ThemeTokens) => ({
  heroCard: {
    borderRadius: t.radii.xl,
    padding: t.spacing.xl,
    gap: t.spacing.xs,
    backgroundColor: t.color.primaryMuted,
    borderWidth: 1,
    borderColor: t.color.primary + "26",
  },
  heroMetaRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: t.spacing.sm,
    flexWrap: "wrap" as const,
  },
  changePill: {
    minHeight: 30,
    borderRadius: t.radii.full,
    paddingHorizontal: t.spacing.sm,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
  },
  errorCard: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    gap: t.spacing.md,
  },
  metricIconWrap: {
    width: 48,
    height: 48,
    borderRadius: t.radii.lg,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
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
  categoryRow: { gap: 6 },
  categoryRowTop: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  barTrack: {
    height: 8,
    borderRadius: t.radii.full,
    backgroundColor: t.color.surfaceMuted,
    overflow: "hidden" as const,
  },
  barFill: {
    height: 8,
    borderRadius: t.radii.full,
  },
});
