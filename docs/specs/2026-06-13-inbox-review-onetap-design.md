# Mobile Inbox — One-Tap Review Fix — Design Spec

**Date:** 2026-06-13
**Status:** Approved (design), pending spec review
**Repo:** `yfw-mobile` (Expo/React Native expenses app)
**Parent:** Touchless AP (competitor #3), slice 3. Slices 1 (backend sync scan) and 2
(web "Scan a bill" modal) shipped in the `invoice_app` repo (PRs #403, #404).

## Problem

The expenses inbox (`apps/expenses/app/(tabs)/inbox.tsx`) is meant to let the user
review and confirm OCR/AI work with one tap. It renders inline **Approve**/**Reject**
buttons — but gated on the **wrong review state**, so one-tap confirm is both broken and
missing:

- The inline buttons render only when `review_status === "pending"` (line 150:
  `isPendingReview = item.review_status === "pending"`).
- But the backend `accept-review` action requires `review_result` to exist
  (`ReviewService.accept_review` returns False → HTTP 400 when it doesn't). `review_result`
  is only populated in the **`diff_found`** state (after the review worker compares a
  re-extraction to the stored values). A `pending` item is still awaiting the worker and
  has no `review_result`.
- Net effect:
  - **`pending` items** show Approve/Reject, but tapping Approve **400s** (and the row is
    labelled "Processing" — contradictory).
  - **`diff_found` items** — the ones that genuinely have an actionable result — show **no**
    inline buttons (they fall through to the generic "Ready to review" label), forcing a
    trip into the detail screen to accept/reject.

## Goal

Make the inbox's inline one-tap Approve/Reject appear on the **actionable** review state
(`diff_found`) and not on the non-actionable one (`pending`), with a clear label, so a
user can confirm AI review changes in one tap from the inbox.

## Non-goals (out of scope)

- **No backend change.** `accept-review`/`reject-review` already work on `diff_found`;
  we only fix which rows expose them.
- **No "confirm a freshly-OCR'd expense" primitive.** A done + `not_started` expense is
  already a valid saved record; there is no backend acknowledge action for it, and adding
  one is a separate decision.
- **No inline diff text** ("amount 12.50 → 13.00"). That would require exposing
  `review_result` in the mobile expense API (`mobile_expense.py` serialization + the
  mobile Zod schema) — deferred stretch, explicitly not in this slice.

## Design

All changes are in `apps/expenses/app/(tabs)/inbox.tsx`.

**1. `getInboxState` (line ~11):** add an explicit branch for the actionable state.
Order: failed → "Needs attention"; processing/queued/`pending` → "Processing";
**`diff_found` → "Review changes"** with a **distinct actionable tone** — amber
`#d97706` on `#fffbeb` (icon `git-pull-request` or `edit-3`) — so it reads as
"action needed", clearly different from the passive emerald "Ready to review". This
keeps `pending` as a non-actionable "Processing" row and gives `diff_found` its own
identity.

**2. Inline-action gate (line ~150, ~183):** rename and re-target the condition:
`const isReviewable = item.review_status === "diff_found";` and render the
Approve/Reject `actionRow` when `isReviewable` (was `isPendingReview`). The buttons
themselves (calling `approveMutation`/`rejectMutation` → `acceptReview`/`rejectReview`
with `e.stopPropagation()` and the `pendingId` busy guard) are unchanged.

**3. Queue summary counts (line ~79-80):** the header shows `attentionCount`
(Needs attention) and `processingCount` (Processing). Add a `reviewCount` =
items whose `getInboxState` label is "Review changes", and surface it in the summary
strip so the actionable backlog is visible. (`pending` items remain in `processingCount`.)

No change to the queue **filter** (line ~68-76) — it already includes both `pending`
and `diff_found`; only the per-row treatment changes.

## Data flow

Inbox query → per item, `getInboxState` derives the label; `isReviewable` derives whether
to show inline actions. Approve → `acceptReview(id)` (applies `review_result`, sets
`review_status="reviewed"`), Reject → `rejectReview(id)`; both invalidate the inbox query
on success, so the row updates/leaves the queue. Identical to today, just on the right rows.

## Error handling

The existing `pendingId`/`isActing` busy guard and the mutations' error handling are
unchanged. Because actions now fire only on `diff_found` (which has `review_result`), the
previous latent 400-on-`pending` path is eliminated.

## Testing

The mobile repo has **no test runner wired** (per `apps/expenses` CLAUDE.md). Verify with:
- `cd apps/expenses && npx tsc --noEmit` — clean.
- Manual / reasoning check of the state→label→buttons matrix:
  - `analysis_status` failed → "Needs attention", no review buttons.
  - `pending` → "Processing", **no** review buttons.
  - `diff_found` → "Review changes", **Approve/Reject** shown; Approve calls
    `acceptReview`, Reject calls `rejectReview`.
  - done + `not_started` (has attachment) → "Ready to review", no review buttons (open
    detail to edit) — unchanged.

## Files touched

- `apps/expenses/app/(tabs)/inbox.tsx` (modify `getInboxState`, the row gate, and the
  summary counts).

## Risks

- **Low traffic:** `diff_found` only arises after a review is explicitly run
  (`submitForReview`), which the pure snap→OCR flow doesn't auto-trigger. The fix is still
  correct (today those rows are un-actionable from the inbox) and removes the broken
  `pending` buttons, but the visible impact depends on users running reviews.
- **Label/tone parity:** "Review changes" uses a distinct amber tone so it reads as
  actionable, clearly different from the passive emerald "Ready to review".
