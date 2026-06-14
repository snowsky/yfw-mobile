# Mobile Inbox One-Tap Review Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the inbox's inline Approve/Reject appear on the actionable `diff_found` review state (with a distinct "Review changes" label) instead of the non-actionable `pending` state.

**Architecture:** A single-file change in `apps/expenses/app/(tabs)/inbox.tsx`: add a `diff_found` branch to `getInboxState`, re-target the per-row action gate from `pending` → `diff_found`, and add a queue counter for the actionable state. No backend change.

**Tech Stack:** Expo / React Native, TypeScript, react-query, Feather icons.

**Spec:** `docs/specs/2026-06-13-inbox-review-onetap-design.md`.

**Conventions:**
- No test runner is wired in this repo. Verify types from the app dir: `cd apps/expenses && npx tsc --noEmit`.
- `getInboxState` returns `{ label, icon, tone, bg }`; `icon` is passed to `<Feather name={state.icon as any}>` (so any valid Feather name works, e.g. `edit-3`).

---

## Task 1: Re-target the inbox review state

**Files:** Modify `apps/expenses/app/(tabs)/inbox.tsx`

- [ ] **Step 1: Add a `diff_found` branch to `getInboxState`**

Find (lines ~11-21):
```tsx
function getInboxState(expense: { analysis_status?: string | null; review_status?: string | null }) {
  if (expense.analysis_status === "failed" || expense.review_status === "failed") {
    return { label: "Needs attention", icon: "alert-circle", tone: "#dc2626", bg: "#fef2f2" };
  }

  if (expense.analysis_status === "processing" || expense.analysis_status === "queued" || expense.review_status === "pending") {
    return { label: "Processing", icon: "clock", tone: "#0284c7", bg: "#eff6ff" };
  }

  return { label: "Ready to review", icon: "check-circle", tone: "#059669", bg: "#ecfdf5" };
}
```
Replace with (adds the `diff_found` branch before the final return):
```tsx
function getInboxState(expense: { analysis_status?: string | null; review_status?: string | null }) {
  if (expense.analysis_status === "failed" || expense.review_status === "failed") {
    return { label: "Needs attention", icon: "alert-circle", tone: "#dc2626", bg: "#fef2f2" };
  }

  if (expense.analysis_status === "processing" || expense.analysis_status === "queued" || expense.review_status === "pending") {
    return { label: "Processing", icon: "clock", tone: "#0284c7", bg: "#eff6ff" };
  }

  if (expense.review_status === "diff_found") {
    return { label: "Review changes", icon: "edit-3", tone: "#d97706", bg: "#fffbeb" };
  }

  return { label: "Ready to review", icon: "check-circle", tone: "#059669", bg: "#ecfdf5" };
}
```

- [ ] **Step 2: Re-target the per-row action gate**

Find (line ~150):
```tsx
            const isPendingReview = item.review_status === "pending";
```
Replace with:
```tsx
            const isReviewable = item.review_status === "diff_found";
```

Then find (line ~183):
```tsx
                {isPendingReview ? (
```
Replace with:
```tsx
                {isReviewable ? (
```

- [ ] **Step 3: Add the actionable-state counter**

Find (line ~80):
```tsx
  const processingCount = items.filter((expense) => getInboxState(expense).label === "Processing").length;
```
Replace with:
```tsx
  const processingCount = items.filter((expense) => getInboxState(expense).label === "Processing").length;
  const reviewCount = items.filter((expense) => getInboxState(expense).label === "Review changes").length;
```

Then find the summary strip's "Processing" item (lines ~121-124):
```tsx
            <View style={styles.queueSummaryItem}>
              <Text style={styles.summaryValue}>{processingCount}</Text>
              <Text style={styles.summaryLabel}>Processing</Text>
            </View>
```
Replace with (append a "To review" item after it):
```tsx
            <View style={styles.queueSummaryItem}>
              <Text style={styles.summaryValue}>{processingCount}</Text>
              <Text style={styles.summaryLabel}>Processing</Text>
            </View>
            <View style={styles.queueSummaryItem}>
              <Text style={styles.summaryValue}>{reviewCount}</Text>
              <Text style={styles.summaryLabel}>To review</Text>
            </View>
```

- [ ] **Step 4: Type-check**

Run: `cd apps/expenses && npx tsc --noEmit 2>&1 | grep "inbox.tsx" || echo "no tsc errors in inbox.tsx"`
Expected: `no tsc errors in inbox.tsx`

- [ ] **Step 5: Confirm no stray references to the old name remain**

Run: `grep -n "isPendingReview" "apps/expenses/app/(tabs)/inbox.tsx" || echo "no isPendingReview left"`
Expected: `no isPendingReview left`

- [ ] **Step 6: Commit**

```bash
git add "apps/expenses/app/(tabs)/inbox.tsx"
git commit -m "fix(inbox): one-tap approve/reject on diff_found (actionable) not pending"
```

---

## Task 2: Verification (state matrix)

**Files:** none (verification only).

- [ ] **Step 1: Full type-check**

Run: `cd apps/expenses && npx tsc --noEmit 2>&1 | tail -5`
Expected: no errors (or only pre-existing errors unrelated to `inbox.tsx`).

- [ ] **Step 2: Confirm the state→label→buttons matrix in the code**

Read `apps/expenses/app/(tabs)/inbox.tsx` and verify by inspection:
- `analysis_status === "failed"` → label "Needs attention", `isReviewable` false → no review buttons.
- `review_status === "pending"` → label "Processing", `isReviewable` false → **no** review buttons.
- `review_status === "diff_found"` → label "Review changes", `isReviewable` true → **Approve/Reject** shown; Approve → `approveMutation` (`acceptReview`), Reject → `rejectMutation` (`rejectReview`).
- otherwise (done/not_started with an attachment) → label "Ready to review", no review buttons.

- [ ] **Step 3: No commit** — verification only.

---

## Self-Review (completed by plan author)

**Spec coverage:**
- `diff_found` → "Review changes" actionable label (amber `#d97706`/`#fffbeb`) → Task 1 Step 1.
- Inline actions gated on `diff_found`, removed from `pending` → Task 1 Step 2.
- Queue counter for the actionable state → Task 1 Step 3.
- No backend change; buttons/mutations unchanged → confirmed (only the gate condition and label change).
- tsc verification (no test runner) → Task 1 Step 4, Task 2.

**Placeholder scan:** none.

**Type consistency:** the gate variable is renamed `isPendingReview` → `isReviewable` at BOTH its definition (Step 2a) and its use (Step 2b); Step 5 guards against a stray old reference. `getInboxState`'s return shape is unchanged (same `{label, icon, tone, bg}` keys). `reviewCount` mirrors the existing `processingCount` filter pattern.
