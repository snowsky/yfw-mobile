import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { expensesApi } from "../../src/lib/api";
import { useAuth } from "../../src/providers/AuthProvider";

function asCurrency(value: number | undefined, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export default function InsightsScreen() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ["expenses", "insights"],
    queryFn: expensesApi.getSummary,
    enabled: Boolean(accessToken),
  });

  const current = query.data?.current_period;
  const previous = query.data?.previous_period;
  const change = query.data?.changes?.total_amount_percent ?? 0;

  const cards = [
    {
      title: "This month",
      value: asCurrency(current?.total_amount),
      detail: `${current?.count ?? 0} expenses`,
      icon: "credit-card",
    },
    {
      title: "Previous month",
      value: asCurrency(previous?.total_amount),
      detail: `${previous?.count ?? 0} expenses`,
      icon: change > 0 ? "trending-up" : "trending-down",
    },
    {
      title: "Change",
      value: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
      detail: "Compared with previous period",
      icon: change > 0 ? "arrow-up-right" : "arrow-down-right",
    },
  ];

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Simple, personal, glanceable</Text>
          <Text style={styles.heroBody}>
            Mobile insights should answer “how am I doing?” in a few seconds.
          </Text>
        </View>

        {query.isLoading ? (
          <View style={styles.metricCard}>
            <Text style={styles.emptyText}>Loading monthly summary...</Text>
          </View>
        ) : (
          cards.map((card) => (
            <View key={card.title} style={styles.metricCard}>
              <View>
                <Text style={styles.metricLabel}>{card.title}</Text>
                <Text style={styles.metricValue}>{card.value}</Text>
                <Text style={styles.metricDetail}>{card.detail}</Text>
              </View>
              <View style={styles.metricIconWrap}>
                <Feather name={card.icon as any} size={18} color="#059669" />
              </View>
            </View>
          ))
        )}

        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>Category breakdown</Text>
          <Text style={styles.breakdownBody}>
            This is the first glanceable chart card for the standalone app.
          </Text>

          {(query.data?.category_breakdown ?? []).slice(0, 5).map((category) => (
            <View key={category.category} style={styles.categoryRow}>
              <View style={styles.categoryRowTop}>
                <Text style={styles.categoryName}>{category.category}</Text>
                <Text style={styles.categoryAmount}>{asCurrency(category.total_amount)}</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.min(100, Number(category.percentage || 0))}%` },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  screen: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 16, gap: 16 },
  heroCard: {
    borderRadius: 28,
    padding: 20,
    gap: 8,
    backgroundColor: "#0F172A",
    shadowColor: "#cbd5e1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  heroTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 28,
    color: "#ffffff",
  },
  heroBody: {
    fontFamily: "Outfit_400Regular",
    fontSize: 15,
    lineHeight: 22,
    color: "#cbd5e1",
  },
  metricCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    shadowColor: "#cbd5e1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  metricLabel: {
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
    color: "#64748B",
  },
  metricValue: {
    marginTop: 4,
    fontFamily: "Outfit_700Bold",
    fontSize: 28,
    color: "#0F172A",
  },
  metricDetail: {
    marginTop: 4,
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    color: "#64748B",
  },
  metricIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
  },
  breakdownCard: {
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
  breakdownTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 20,
    color: "#0F172A",
  },
  breakdownBody: {
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
  },
  categoryRow: {
    gap: 6,
  },
  categoryRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryName: {
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
    color: "#0F172A",
  },
  categoryAmount: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 14,
    color: "#0F172A",
  },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  barFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#059669",
  },
  emptyText: {
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
  },
});
