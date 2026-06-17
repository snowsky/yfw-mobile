import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { expensesApi, type Expense, type ExpenseUpdate } from "../../src/lib/api";
import { useTheme, useThemedStyles } from "../../src/theme";
import { ThemeTokens, ColorTokens } from "../../src/theme/types";
import { Input, Button, Text } from "../../src/components/ui";
import { formatMoney, formatDate } from "../../src/lib/format";

type FormState = {
  amount: string;
  vendor: string;
  category: string;
  notes: string;
  expense_date: string;
};

function toForm(expense: Expense): FormState {
  return {
    amount: expense.amount != null ? String(expense.amount) : "",
    vendor: expense.vendor ?? "",
    category: expense.category ?? "",
    notes: expense.notes ?? "",
    expense_date: expense.expense_date ?? "",
  };
}

function diffPatch(form: FormState, expense: Expense): ExpenseUpdate {
  const patch: ExpenseUpdate = {};
  const parsedAmount = form.amount.trim() === "" ? null : Number(form.amount);
  if (parsedAmount !== (expense.amount ?? null) && !Number.isNaN(parsedAmount as number)) {
    patch.amount = parsedAmount;
  }
  if (form.vendor !== (expense.vendor ?? "")) patch.vendor = form.vendor || null;
  if (form.category !== expense.category) patch.category = form.category;
  if (form.notes !== (expense.notes ?? "")) patch.notes = form.notes || null;
  if (form.expense_date !== expense.expense_date) patch.expense_date = form.expense_date;
  return patch;
}

// Map a review status to a semantic color token key for the status pill.
function reviewStatusKey(status: string): keyof ColorTokens {
  if (status === "approved") return "success";
  if (status === "rejected" || status === "failed") return "danger";
  if (status === "pending") return "info";
  return "textMuted";
}

export default function ExpenseDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tokens } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const expenseId = Number(idParam);

  const query = useQuery({
    queryKey: ["expenses", "detail", expenseId],
    queryFn: () => expensesApi.getExpense(expenseId),
    enabled: Number.isFinite(expenseId),
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (query.data) setForm(toForm(query.data));
  }, [query.data]);

  function invalidateAll(updated?: Expense) {
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
    if (updated) {
      queryClient.setQueryData(["expenses", "detail", expenseId], updated);
    }
  }

  const saveMutation = useMutation({
    mutationFn: (patch: ExpenseUpdate) => expensesApi.updateExpense(expenseId, patch),
    onSuccess: (updated) => {
      setActionError(null);
      invalidateAll(updated);
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : "Save failed."),
  });

  const submitMutation = useMutation({
    mutationFn: () => expensesApi.submitForReview(expenseId),
    onSuccess: (updated) => {
      setActionError(null);
      invalidateAll(updated);
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : "Submit failed."),
  });

  const approveMutation = useMutation({
    mutationFn: () => expensesApi.acceptReview(expenseId),
    onSuccess: (updated) => {
      setActionError(null);
      invalidateAll(updated);
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : "Approve failed."),
  });

  const rejectMutation = useMutation({
    mutationFn: () => expensesApi.rejectReview(expenseId),
    onSuccess: (updated) => {
      setActionError(null);
      invalidateAll(updated);
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : "Reject failed."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => expensesApi.deleteExpense(expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      router.back();
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : "Delete failed."),
  });

  const anyMutating =
    saveMutation.isPending ||
    submitMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending ||
    deleteMutation.isPending;

  const expense = query.data;
  const dirty = expense && form ? Object.keys(diffPatch(form, expense)).length > 0 : false;

  function handleSave() {
    if (!expense || !form) return;
    const patch = diffPatch(form, expense);
    if (Object.keys(patch).length === 0) return;
    saveMutation.mutate(patch);
  }

  function confirmDelete() {
    Alert.alert(
      "Delete expense?",
      "This moves the expense to the recycle bin.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate() },
      ]
    );
  }

  function StatusPill({ label, statusKey }: { label: string; statusKey: keyof ColorTokens }) {
    const accent = tokens.color[statusKey];
    return (
      <View style={[styles.pill, { backgroundColor: accent + "1A" }]}>
        <Text variant="caption" style={{ color: accent }}>{label}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Feather name="chevron-left" size={22} color={tokens.color.text} />
        </Pressable>
        <Text variant="headingMd">Expense</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete expense"
          hitSlop={12}
          onPress={confirmDelete}
          disabled={anyMutating || !expense}
          style={[styles.iconBtn, (anyMutating || !expense) && styles.buttonDisabled]}
        >
          <Feather name="trash-2" size={18} color={tokens.color.danger} />
        </Pressable>
      </View>

      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {query.isLoading || !expense || !form ? (
          <View style={styles.card}>
            {query.isError ? (
              <>
                <Text variant="headingMd">Could not load expense</Text>
                <Text variant="bodyMd" color="textMuted">
                  {query.error instanceof Error ? query.error.message : "Try again shortly."}
                </Text>
                <Button label="Try again" size="sm" onPress={() => query.refetch()} style={{ alignSelf: "flex-start", marginTop: 4 }} />
              </>
            ) : (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={tokens.color.primary} />
                <Text variant="bodyMd" color="textMuted">Loading expense…</Text>
              </View>
            )}
          </View>
        ) : (
          <>
            <View style={styles.heroCard}>
              <Text variant="headingXl">{formatMoney(expense.amount, expense.currency)}</Text>
              <Text variant="bodyLg" color="textMuted">{expense.vendor ?? "Unknown vendor"}</Text>
              <View style={styles.heroMetaRow}>
                <Text variant="bodySm" color="textMuted">{expense.category}</Text>
                <Text variant="bodySm" color="textMuted">·</Text>
                <Text variant="bodySm" color="textMuted">{formatDate(expense.expense_date)}</Text>
              </View>
              <View style={styles.pillsRow}>
                {expense.review_status ? (
                  <StatusPill label={`review: ${expense.review_status}`} statusKey={reviewStatusKey(expense.review_status)} />
                ) : null}
                {expense.analysis_status ? (
                  <StatusPill label={`analysis: ${expense.analysis_status}`} statusKey="textMuted" />
                ) : null}
                {expense.attachments_count ? (
                  <StatusPill
                    label={`${expense.attachments_count} attachment${expense.attachments_count === 1 ? "" : "s"}`}
                    statusKey="textMuted"
                  />
                ) : null}
              </View>
            </View>

            <View style={styles.card}>
              <Text variant="headingMd">Edit Details</Text>

              <Input
                label="Amount"
                value={form.amount}
                onChangeText={(v) => setForm({ ...form, amount: v })}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
              <Input
                label="Vendor"
                value={form.vendor}
                onChangeText={(v) => setForm({ ...form, vendor: v })}
                placeholder="Vendor name"
              />
              <Input
                label="Category"
                value={form.category}
                onChangeText={(v) => setForm({ ...form, category: v })}
                placeholder="Category"
              />
              <Input
                label="Date (YYYY-MM-DD)"
                value={form.expense_date}
                onChangeText={(v) => setForm({ ...form, expense_date: v })}
                placeholder="2025-04-23"
                autoCapitalize="none"
              />
              <Input
                label="Notes"
                value={form.notes}
                onChangeText={(v) => setForm({ ...form, notes: v })}
                placeholder="Add a note"
                multiline
                numberOfLines={3}
                style={styles.textarea}
              />

              {actionError ? <Text variant="bodySm" color="danger">{actionError}</Text> : null}

              <View style={styles.inlineRow}>
                <Button
                  label="Save changes"
                  onPress={handleSave}
                  loading={saveMutation.isPending}
                  disabled={!dirty || anyMutating}
                />
                {dirty ? (
                  <Button label="Discard" variant="outline" onPress={() => setForm(toForm(expense))} disabled={anyMutating} />
                ) : null}
              </View>
            </View>

            {expense.attachments_count ? (
              <View style={styles.card}>
                <Text variant="headingMd">Linked Receipt</Text>
                <View style={styles.attachmentRow}>
                  <View style={styles.attachmentIconCircle}>
                    <Feather name="file-text" size={20} color={tokens.color.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyMd" style={{ fontFamily: "Inter_600SemiBold" }}>Receipt attachment ({expense.attachments_count})</Text>
                    <Text variant="bodySm" color="textMuted">Scan processed and stored in database</Text>
                  </View>
                </View>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text variant="headingMd">Review</Text>
              {expense.review_status === "pending" ? (
                <View style={styles.inlineRow}>
                  <Button label="Approve" onPress={() => approveMutation.mutate()} loading={approveMutation.isPending} disabled={anyMutating} />
                  <Button label="Reject" variant="destructive" onPress={() => rejectMutation.mutate()} loading={rejectMutation.isPending} disabled={anyMutating} />
                </View>
              ) : (
                <Button label="Submit for review" onPress={() => submitMutation.mutate()} loading={submitMutation.isPending} disabled={anyMutating} />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (t: ThemeTokens) => ({
  safeArea: { flex: 1, backgroundColor: t.color.background },
  screen: { flex: 1, backgroundColor: t.color.background },
  content: { padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: 40 },

  topBar: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    backgroundColor: t.color.background,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: t.radii.md,
    alignItems: "center" as const, justifyContent: "center" as const,
    backgroundColor: t.color.surface, borderWidth: 1, borderColor: t.color.border,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: t.radii.md,
    alignItems: "center" as const, justifyContent: "center" as const,
    backgroundColor: t.color.danger + "1A", borderWidth: 1, borderColor: t.color.danger + "33",
  },
  buttonDisabled: { opacity: 0.55 },

  heroCard: {
    borderRadius: t.radii.xl, padding: t.spacing.lg, gap: t.spacing.sm, backgroundColor: t.color.surface,
    ...t.shadow.soft,
  },
  heroMetaRow: { flexDirection: "row" as const, gap: t.spacing.sm, alignItems: "center" as const },

  pillsRow: { flexDirection: "row" as const, gap: 6, flexWrap: "wrap" as const, marginTop: 4 },
  pill: { borderRadius: t.radii.full, paddingHorizontal: t.spacing.sm, paddingVertical: 5 },

  card: {
    borderRadius: t.radii.xl, padding: t.spacing.lg, gap: t.spacing.md, backgroundColor: t.color.surface,
    ...t.shadow.soft,
  },

  textarea: { minHeight: 88, textAlignVertical: "top" as const, paddingTop: 12 },

  attachmentRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: t.color.surfaceMuted,
    borderWidth: 1,
    borderColor: t.color.border,
    borderRadius: t.radii.lg,
    padding: t.spacing.md,
  },
  attachmentIconCircle: {
    width: 44,
    height: 44,
    borderRadius: t.radii.md,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: t.color.primaryMuted,
    marginRight: t.spacing.md,
  },

  inlineRow: { flexDirection: "row" as const, gap: t.spacing.sm, flexWrap: "wrap" as const },
  loadingRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: t.spacing.sm },
});
