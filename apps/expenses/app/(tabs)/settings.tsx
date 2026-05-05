import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";

import { preferencesApi, type ExpenseDigestSelection } from "../../src/lib/api";
import { useAuth } from "../../src/providers/AuthProvider";

const options: Array<{
  value: ExpenseDigestSelection;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}> = [
  { value: "off", label: "Off", icon: "bell-off" },
  { value: "daily", label: "Daily", icon: "sun" },
  { value: "weekly", label: "Weekly", icon: "calendar" },
];

function preferenceToSelection(enabled?: boolean, frequency?: "daily" | "weekly"): ExpenseDigestSelection {
  if (!enabled) return "off";
  return frequency === "daily" ? "daily" : "weekly";
}

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const { accessToken, user, logout } = useAuth();
  const query = useQuery({
    queryKey: ["preferences", "expense-digest"],
    queryFn: preferencesApi.getExpenseDigestPreference,
    enabled: Boolean(accessToken),
  });

  const mutation = useMutation({
    mutationFn: preferencesApi.updateExpenseDigestPreference,
    onSuccess: (data) => {
      queryClient.setQueryData(["preferences", "expense-digest"], data);
    },
  });

  const selected = mutation.variables ?? preferenceToSelection(query.data?.enabled, query.data?.frequency);
  const isSaving = mutation.isPending;
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || "Account";

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Feather name="settings" size={20} color="#059669" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>{displayName}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Expense digest</Text>
              <Text style={styles.cardBody}>Personal email summaries for expenses you create.</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>{isSaving ? "Saving" : query.isLoading ? "Loading" : "Synced"}</Text>
            </View>
          </View>

          <View style={styles.segmented}>
            {options.map((option) => {
              const active = selected === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: isSaving }}
                  disabled={isSaving}
                  onPress={() => mutation.mutate(option.value)}
                  style={[styles.segmentButton, active && styles.segmentButtonActive]}
                >
                  <Feather name={option.icon} size={17} color={active ? "#ffffff" : "#475569"} />
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {mutation.isError ? (
            <Text style={styles.errorText}>
              {mutation.error instanceof Error ? mutation.error.message : "Failed to save digest preference."}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <View style={styles.accountRow}>
            <View style={styles.accountIcon}>
              <Feather name="user" size={18} color="#059669" />
            </View>
            <View style={styles.accountText}>
              <Text style={styles.accountName}>{displayName}</Text>
              <Text style={styles.accountMeta} numberOfLines={1}>{user?.email}</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={logout} style={styles.logoutButton}>
            <Feather name="log-out" size={18} color="#ef4444" />
            <Text style={styles.logoutText}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  screen: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 16, gap: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  headerText: { flex: 1 },
  title: {
    fontFamily: "Outfit_700Bold",
    fontSize: 28,
    color: "#0F172A",
  },
  subtitle: {
    marginTop: 2,
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
    color: "#64748B",
  },
  card: {
    borderRadius: 18,
    padding: 18,
    gap: 16,
    backgroundColor: "#ffffff",
    shadowColor: "#cbd5e1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 19,
    color: "#0F172A",
  },
  cardBody: {
    marginTop: 4,
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
  },
  statusPill: {
    minWidth: 68,
    minHeight: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 10,
  },
  statusText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 12,
    color: "#047857",
  },
  segmented: {
    flexDirection: "row",
    gap: 8,
    padding: 4,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  segmentButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  segmentButtonActive: {
    backgroundColor: "#059669",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 14,
    color: "#475569",
  },
  segmentTextActive: {
    color: "#ffffff",
  },
  errorText: {
    fontFamily: "Outfit_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: "#ef4444",
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  accountIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
  },
  accountText: { flex: 1 },
  accountName: {
    fontFamily: "Outfit_700Bold",
    fontSize: 15,
    color: "#0F172A",
  },
  accountMeta: {
    marginTop: 2,
    fontFamily: "Outfit_400Regular",
    fontSize: 13,
    color: "#64748B",
  },
  logoutButton: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  logoutText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 15,
    color: "#ef4444",
  },
});
