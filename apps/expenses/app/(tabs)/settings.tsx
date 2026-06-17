import { Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { preferencesApi, type ExpenseDigestSelection } from "../../src/lib/api";
import { queryKeys } from "../../src/lib/queryKeys";
import { useAuth } from "../../src/providers/AuthProvider";
import { useTheme, useThemedStyles } from "../../src/theme";
import { ThemeTokens, ThemeMode } from "../../src/theme/types";
import { Screen, Card, PageHeader, SegmentedControl, Avatar, Badge, Button, Text } from "../../src/components/ui";

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
  const { tokens, mode, setMode } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const query = useQuery({
    queryKey: queryKeys.expenseDigest,
    queryFn: preferencesApi.getExpenseDigestPreference,
    enabled: Boolean(accessToken),
  });

  const mutation = useMutation({
    mutationFn: preferencesApi.updateExpenseDigestPreference,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.expenseDigest, data);
    },
  });

  const selected = mutation.variables ?? preferenceToSelection(query.data?.enabled, query.data?.frequency);
  const isSaving = mutation.isPending;
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || "Account";
  const initials = [user?.first_name, user?.last_name]
    .filter((n): n is string => typeof n === "string" && n.length > 0)
    .map((name) => name[0].toUpperCase())
    .join("") || user?.email?.slice(0, 2).toUpperCase() || "US";

  return (
    <Screen scroll contentContainerStyle={{ gap: tokens.spacing.lg }}>
      <PageHeader title="Settings" subtitle={displayName} />

      <Card variant="elevated" style={{ gap: tokens.spacing.lg }}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="headingMd">Expense digest</Text>
            <Text variant="bodyMd" color="textMuted">Personal email summaries for expenses you create.</Text>
          </View>
          <Badge
            label={isSaving ? "Saving" : query.isLoading ? "Loading" : "Synced"}
            status="success"
            appearance="soft"
          />
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
                <Feather name={option.icon} size={17} color={active ? tokens.color.onPrimary : tokens.color.textMuted} />
                <Text variant="bodyMd" style={{ color: active ? tokens.color.onPrimary : tokens.color.textMuted, fontFamily: "Inter_600SemiBold" }}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mutation.isError ? (
          <Text variant="bodySm" color="danger">
            {mutation.error instanceof Error ? mutation.error.message : "Failed to save digest preference."}
          </Text>
        ) : null}
      </Card>

      <Card variant="elevated" style={{ gap: tokens.spacing.md }}>
        <Text variant="headingMd">Appearance</Text>
        <SegmentedControl<ThemeMode>
          options={[
            { label: "System", value: "system" },
            { label: "Light", value: "light" },
            { label: "Dark", value: "dark" },
          ]}
          value={mode}
          onChange={setMode}
        />
      </Card>

      <Card variant="elevated" style={{ gap: tokens.spacing.md }}>
        <Text variant="headingMd">Account Profile</Text>
        <View style={styles.profileCard}>
          <Avatar initials={initials} size={56} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text variant="headingSm">{displayName}</Text>
            <Text variant="bodySm" color="textMuted" numberOfLines={1}>{user?.email}</Text>
            <Badge label="Organization Member" status="success" appearance="soft" />
          </View>
        </View>
        <Button
          label="Sign out"
          variant="destructive"
          onPress={logout}
          leftIcon={<Feather name="log-out" size={18} color={tokens.color.onPrimary} />}
        />
      </Card>
    </Screen>
  );
}

const makeStyles = (t: ThemeTokens) => ({
  cardHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
    gap: t.spacing.md,
  },
  segmented: {
    flexDirection: "row" as const,
    gap: t.spacing.sm,
    padding: 4,
    borderRadius: t.radii.lg,
    backgroundColor: t.color.surfaceMuted,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  segmentButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: t.radii.md,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    flexDirection: "row" as const,
    gap: 6,
  },
  segmentButtonActive: {
    backgroundColor: t.color.primary,
    ...t.shadow.soft,
  },
  profileCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: t.color.surfaceMuted,
    borderWidth: 1,
    borderColor: t.color.border,
    borderRadius: t.radii.lg,
    padding: t.spacing.lg,
    gap: t.spacing.lg,
  },
});
