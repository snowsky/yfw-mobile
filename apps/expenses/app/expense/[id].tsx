import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { expensesApi, type Expense, type ExpenseUpdate } from "../../src/lib/api";

function formatMoney(amount: number | null | undefined, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);
}

function formatDateLabel(dateString: string | null | undefined) {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateString}T00:00:00`));
}

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

export default function ExpenseDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
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
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </Pressable>
        <Text style={styles.topTitle}>Expense</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete expense"
          hitSlop={12}
          onPress={confirmDelete}
          disabled={anyMutating || !expense}
          style={[styles.iconBtn, (anyMutating || !expense) && styles.buttonDisabled]}
        >
          <Feather name="trash-2" size={18} color="#dc2626" />
        </Pressable>
      </View>

      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {query.isLoading || !expense || !form ? (
          <View style={styles.card}>
            {query.isError ? (
              <>
                <Text style={styles.emptyTitle}>Could not load expense</Text>
                <Text style={styles.emptyText}>
                  {query.error instanceof Error ? query.error.message : "Try again shortly."}
                </Text>
                <Pressable style={styles.retryButton} onPress={() => query.refetch()}>
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#059669" />
                <Text style={styles.emptyText}>Loading expense…</Text>
              </View>
            )}
          </View>
        ) : (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroAmount}>{formatMoney(expense.amount, expense.currency)}</Text>
              <Text style={styles.heroVendor}>{expense.vendor ?? "Unknown vendor"}</Text>
              <View style={styles.heroMetaRow}>
                <Text style={styles.heroMeta}>{expense.category}</Text>
                <Text style={styles.heroMeta}>·</Text>
                <Text style={styles.heroMeta}>{formatDateLabel(expense.expense_date)}</Text>
              </View>
              <View style={styles.pillsRow}>
                {expense.review_status ? (
                  <View style={[styles.pill, pillStyleForReview(expense.review_status)]}>
                    <Text style={styles.pillText}>review: {expense.review_status}</Text>
                  </View>
                ) : null}
                {expense.analysis_status ? (
                  <View style={[styles.pill, styles.pillNeutral]}>
                    <Text style={styles.pillText}>analysis: {expense.analysis_status}</Text>
                  </View>
                ) : null}
                {expense.attachments_count ? (
                  <View style={[styles.pill, styles.pillNeutral]}>
                    <Text style={styles.pillText}>
                      {expense.attachments_count} attachment{expense.attachments_count === 1 ? "" : "s"}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Edit</Text>

              <Field label="Amount">
                <TextInput
                  value={form.amount}
                  onChangeText={(v) => setForm({ ...form, amount: v })}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#94a3b8"
                  style={styles.input}
                />
              </Field>

              <Field label="Vendor">
                <TextInput
                  value={form.vendor}
                  onChangeText={(v) => setForm({ ...form, vendor: v })}
                  placeholder="Vendor name"
                  placeholderTextColor="#94a3b8"
                  style={styles.input}
                />
              </Field>

              <Field label="Category">
                <TextInput
                  value={form.category}
                  onChangeText={(v) => setForm({ ...form, category: v })}
                  placeholder="Category"
                  placeholderTextColor="#94a3b8"
                  style={styles.input}
                />
              </Field>

              <Field label="Date (YYYY-MM-DD)">
                <TextInput
                  value={form.expense_date}
                  onChangeText={(v) => setForm({ ...form, expense_date: v })}
                  placeholder="2025-04-23"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  style={styles.input}
                />
              </Field>

              <Field label="Notes">
                <TextInput
                  value={form.notes}
                  onChangeText={(v) => setForm({ ...form, notes: v })}
                  placeholder="Add a note"
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={3}
                  style={[styles.input, styles.textarea]}
                />
              </Field>

              {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

              <View style={styles.inlineRow}>
                <Pressable
                  accessibilityRole="button"
                  style={[styles.primaryBtn, (!dirty || anyMutating) && styles.buttonDisabled]}
                  onPress={handleSave}
                  disabled={!dirty || anyMutating}
                >
                  {saveMutation.isPending ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Save changes</Text>
                  )}
                </Pressable>
                {dirty ? (
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.outlineBtn, anyMutating && styles.buttonDisabled]}
                    onPress={() => setForm(toForm(expense))}
                    disabled={anyMutating}
                  >
                    <Text style={styles.outlineBtnText}>Discard</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Review</Text>
              {expense.review_status === "pending" ? (
                <View style={styles.inlineRow}>
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.primaryBtn, anyMutating && styles.buttonDisabled]}
                    onPress={() => approveMutation.mutate()}
                    disabled={anyMutating}
                  >
                    {approveMutation.isPending ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Approve</Text>
                    )}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.dangerBtn, anyMutating && styles.buttonDisabled]}
                    onPress={() => rejectMutation.mutate()}
                    disabled={anyMutating}
                  >
                    {rejectMutation.isPending ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Reject</Text>
                    )}
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  style={[styles.primaryBtn, anyMutating && styles.buttonDisabled]}
                  onPress={() => submitMutation.mutate()}
                  disabled={anyMutating}
                >
                  {submitMutation.isPending ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Submit for review</Text>
                  )}
                </Pressable>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function pillStyleForReview(status: string) {
  if (status === "approved") return styles.pillSuccess;
  if (status === "rejected" || status === "failed") return styles.pillDanger;
  if (status === "pending") return styles.pillInfo;
  return styles.pillNeutral;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  screen: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 16, gap: 16, paddingBottom: 40 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F8FAFC",
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e2e8f0",
  },
  topTitle: { fontFamily: "Outfit_700Bold", fontSize: 18, color: "#0F172A" },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca",
  },
  buttonDisabled: { opacity: 0.55 },

  heroCard: {
    borderRadius: 18, padding: 18, gap: 10, backgroundColor: "#ffffff",
    shadowColor: "#cbd5e1", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 2,
  },
  heroAmount: { fontFamily: "Outfit_700Bold", fontSize: 32, color: "#0F172A" },
  heroVendor: { fontFamily: "Outfit_500Medium", fontSize: 16, color: "#475569" },
  heroMetaRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  heroMeta: { fontFamily: "Outfit_500Medium", fontSize: 13, color: "#64748B" },

  pillsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillNeutral: { backgroundColor: "#f1f5f9" },
  pillSuccess: { backgroundColor: "#ecfdf5" },
  pillDanger: { backgroundColor: "#fef2f2" },
  pillInfo: { backgroundColor: "#eff6ff" },
  pillText: { fontFamily: "Outfit_600SemiBold", fontSize: 11, color: "#0F172A" },

  card: {
    borderRadius: 18, padding: 18, gap: 14, backgroundColor: "#ffffff",
    shadowColor: "#cbd5e1", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 2,
  },
  sectionTitle: { fontFamily: "Outfit_700Bold", fontSize: 18, color: "#0F172A" },

  fieldGroup: { gap: 6 },
  fieldLabel: { fontFamily: "Outfit_500Medium", fontSize: 13, color: "#64748B" },
  input: {
    minHeight: 46,
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#f8fafc",
    color: "#0F172A", fontFamily: "Outfit_400Regular", fontSize: 15,
  },
  textarea: { minHeight: 88, textAlignVertical: "top", paddingTop: 12 },

  inlineRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  primaryBtn: {
    minHeight: 46, paddingHorizontal: 18, borderRadius: 14,
    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
    backgroundColor: "#059669",
  },
  primaryBtnText: { color: "#ffffff", fontFamily: "Outfit_700Bold", fontSize: 15 },
  outlineBtn: {
    minHeight: 46, paddingHorizontal: 18, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#ffffff",
  },
  outlineBtnText: { color: "#0F172A", fontFamily: "Outfit_700Bold", fontSize: 15 },
  dangerBtn: {
    minHeight: 46, paddingHorizontal: 18, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#dc2626",
  },

  errorText: { fontFamily: "Outfit_400Regular", fontSize: 13, color: "#ef4444", lineHeight: 18 },

  emptyTitle: { fontFamily: "Outfit_700Bold", fontSize: 18, color: "#0F172A" },
  emptyText: { fontFamily: "Outfit_400Regular", fontSize: 14, lineHeight: 20, color: "#64748B" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  retryButton: {
    alignSelf: "flex-start", minHeight: 42, paddingHorizontal: 16, borderRadius: 14,
    alignItems: "center", justifyContent: "center", backgroundColor: "#059669", marginTop: 8,
  },
  retryText: { fontFamily: "Outfit_700Bold", fontSize: 14, color: "#ffffff" },
});
