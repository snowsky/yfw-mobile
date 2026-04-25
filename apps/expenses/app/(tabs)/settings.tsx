import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Feather name="settings" size={20} color="#0f172a" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>{displayName}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
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
                <Feather name={option.icon} size={17} color={active ? "#ffffff" : "#334155"} />
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
            <Feather name="user" size={18} color="#0f172a" />
          </View>
          <View style={styles.accountText}>
            <Text style={styles.accountName}>{displayName}</Text>
            <Text style={styles.accountMeta}>{user?.email}</Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={logout} style={styles.logoutButton}>
          <Feather name="log-out" size={18} color="#b91c1c" />
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4f8f7" },
  content: { padding: 16, gap: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  headerText: { flex: 1 },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 2,
    fontSize: 14,
    color: "#64748b",
  },
  card: {
    borderRadius: 24,
    padding: 18,
    gap: 16,
    backgroundColor: "#ffffff",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardBody: {
    marginTop: 4,
    maxWidth: 260,
    fontSize: 14,
    lineHeight: 20,
    color: "#64748b",
  },
  statusPill: {
    minWidth: 68,
    minHeight: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
  },
  segmented: {
    flexDirection: "row",
    gap: 8,
    padding: 4,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
  },
  segmentButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  segmentButtonActive: {
    backgroundColor: "#0f766e",
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  segmentTextActive: {
    color: "#ffffff",
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#b91c1c",
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
    backgroundColor: "#f1f5f9",
  },
  accountText: { flex: 1 },
  accountName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  accountMeta: {
    marginTop: 2,
    fontSize: 13,
    color: "#64748b",
  },
  logoutButton: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#fef2f2",
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#b91c1c",
  },
});
