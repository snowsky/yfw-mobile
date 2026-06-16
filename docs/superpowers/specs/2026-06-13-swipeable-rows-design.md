# Swipeable Rows for Inbox & Timeline — Design Spec

**Date:** 2026-06-13
**Status:** Approved for implementation
**Scope:** Phase 1 of a larger "more user-friendly gestures" effort.

## Goal

Make the expenses app feel faster and more tactile by letting users act on
list rows with horizontal swipes instead of only tapping buttons:

- **Inbox:** swipe right → Approve, swipe left → Reject (review actions).
- **Timeline:** swipe left → Delete, with a confirm-via-undo safety net.

## Non-goals (deferred to future, separate specs)

- **Card-stack review** — a Tinder-style full-screen one-card-at-a-time
  reviewer for the Inbox. Will build on this phase's gesture infrastructure.
- **Swipe between tabs** — conflicts with horizontal row-swipe and requires
  replacing expo-router's native bottom-tab navigator. Reconsider later; may
  be dropped in favor of lighter navigation polish.

## Background / current state

- Tabs use expo-router `<Tabs>` (native bottom tab bar). No swipe paging.
- `inbox.tsx` and `timeline.tsx` render rows as `<Pressable>` cards inside a
  `ScrollView` via `.map()` (not `FlatList`). Swipeable rows work fine here.
- Backend actions already exist in `apps/expenses/src/lib/api.ts`:
  `expensesApi.acceptReview(id)`, `rejectReview(id)`, `deleteExpense(id)`.
  **No backend changes are required.**
- **No gesture libraries are installed.** `react-native-gesture-handler` and
  `react-native-reanimated` must be added. `expo-haptics` is also not present.
- `babel.config.js` exists and currently lists only `expo-router/babel`; it
  needs the Reanimated/Worklets Babel plugin added (must be **last** in the
  plugins array).
- Root layout lives at `apps/expenses/app/_layout.tsx`; the workspace-root
  shim `app/_layout.tsx` just re-exports it, so wrapping the tree there covers
  both `expo run` entry points.

## Architecture

### 1. Foundation (one-time setup)

- Install via `npx expo install react-native-gesture-handler
  react-native-reanimated expo-haptics` (from `apps/expenses`) so versions
  match Expo SDK 54.
- Add the Reanimated Babel plugin to `babel.config.js`, last in `plugins`.
  (Exact name depends on the installed Reanimated version —
  `react-native-reanimated/plugin` or `react-native-worklets/plugin`; resolve
  during implementation against the installed version.)
- Wrap the root layout's returned tree in
  `<GestureHandlerRootView style={{ flex: 1 }}>` in
  `apps/expenses/app/_layout.tsx`.

### 2. Shared `SwipeableRow` component

New file: `apps/expenses/src/components/SwipeableRow.tsx` — the app's first
shared component. (Kept in `apps/expenses/src`, not `packages/mobile-core`,
per CLAUDE.md: avoid premature abstraction until a second app exists.)

- Built on `ReanimatedSwipeable` from `react-native-gesture-handler`.
- **Interface:**
  ```ts
  type SwipeAction = {
    label: string;
    icon: keyof typeof Feather.glyphMap;
    color: string;        // background of the revealed panel
    onTrigger: () => void;
  };
  type SwipeableRowProps = {
    children: React.ReactNode;
    leftAction?: SwipeAction;   // revealed by swiping the row to the RIGHT
    rightAction?: SwipeAction;  // revealed by swiping the row to the LEFT
    disabled?: boolean;         // renders children with no swipe behavior
  };
  ```
  Note the gesture-handler convention: `renderLeftActions` shows when the user
  drags the row rightward. In user terms: **leftAction = "swipe right",
  rightAction = "swipe left".**
- Renders a colored panel (icon + label) behind the row for each provided
  action. Fires an `expo-haptics` selection tick once when a drag crosses the
  activation threshold.
- When `disabled`, renders `children` directly with no wrapper gesture so
  non-actionable rows behave exactly as today.
- Tap-through to open the expense detail is preserved (the inner `Pressable`
  keeps working; swipe and tap don't conflict).

### 3. Inbox integration (`app/(tabs)/inbox.tsx`)

- Wrap each row in `SwipeableRow`.
- For actionable rows (`item.review_status === "diff_found"`):
  - `leftAction` (swipe right) → Approve, teal `#059669`, icon `check`.
  - `rightAction` (swipe left) → Reject, red `#dc2626`, icon `x`.
- For non-actionable rows: pass `disabled` (no swipe).
- **Keep the existing inline Approve/Reject buttons** as the accessible
  fallback — swipe is not screen-reader friendly, so the buttons remain the
  a11y path while swipe is the fast path.
- Make the approve/reject mutations **optimistic**: on trigger, remove the
  card from the `["expenses", "inbox"]` query data immediately via
  `queryClient.setQueryData`, keep the existing `invalidateQueries` on settle,
  and revert the cached data on error.

### 4. Timeline integration (`app/(tabs)/timeline.tsx`)

- Wrap each row in `SwipeableRow` with `rightAction` (swipe left) → Delete,
  red `#dc2626`, icon `trash-2`. No left action.
- **Delete flow (confirm via undo):**
  1. Triggering Delete optimistically removes the row from the displayed list
     and shows the Undo toast for ~4 seconds.
  2. The actual `expensesApi.deleteExpense(id)` call is **deferred** — it fires
     only after the toast window expires (timer-based).
  3. **Undo** cancels the timer and restores the row. No API call is ever made,
     so there is no delete/recreate round-trip.
- Because Timeline holds local removal state for the pending-delete window,
  track pending deletions in component state (e.g. a `Set<number>` of hidden
  ids + the active timer), filtering them out of the rendered list.

### 5. Undo toast component

New file: `apps/expenses/src/components/UndoToast.tsx`.

- Absolute-positioned animated banner near the bottom of the screen with a
  message and an **Undo** button.
- Controlled via props (`visible`, `message`, `onUndo`, `onDismiss`) or a small
  `useUndoToast` hook — implementer's choice, but it must be reusable for any
  future undoable action.
- Auto-dismisses after the configured duration (~4s) and calls back so the
  parent can commit the deferred action.

## Data flow

- All mutations continue through `@tanstack/react-query` as today.
- Inbox approve/reject: optimistic `setQueryData` on `["expenses", "inbox"]`
  → existing `invalidateQueries({ queryKey: ["expenses"] })` on settle.
- Timeline delete: purely local optimistic hide during the undo window; the
  `deleteExpense` mutation runs on timer expiry, then invalidates `["expenses"]`.

## Error handling

- Inbox: if `acceptReview`/`rejectReview` rejects, revert the optimistic cache
  change and surface the existing inline error treatment.
- Timeline: if the deferred `deleteExpense` fails, restore the row and show an
  error (reuse the toast or inline message). Undo within the window prevents the
  call entirely, so it cannot fail.

## Accessibility

- Inbox keeps tappable Approve/Reject buttons for screen-reader users.
- Swipe panels include text labels (not icon-only) so the intent is legible.
- Consider `accessibilityActions` on rows as a follow-up; not required for
  Phase 1.

## Testing & verification

This repo has no lint/test/typecheck scripts wired up (per CLAUDE.md), so:

- **Types:** `npx tsc --noEmit` from `apps/expenses`.
- **Manual checklist:**
  - Inbox: swipe right approves, swipe left rejects, card animates out, list
    refreshes; non-actionable rows don't swipe; inline buttons still work.
  - Timeline: swipe left reveals Delete; tap → row hides + Undo toast.
  - Undo within window → row returns, no network call (verify via logs).
  - Let toast expire → row stays gone, `DELETE` fires.
  - Force an API error → optimistic change reverts and an error is shown.
  - VoiceOver: Inbox buttons remain reachable and functional.
  - Gesture works after rebuild (native deps require a fresh `expo run`, not
    just a Metro reload).

## Risks / notes

- Adding `react-native-gesture-handler` + `react-native-reanimated` requires a
  **native rebuild** (`npm run ios:expenses` / `android:expenses`); a JS-only
  reload will crash with "missing native module".
- The Reanimated Babel plugin **must be last** in the plugins list or worklets
  fail silently.
- `ScrollView` (not `FlatList`) is fine for current list sizes (`limit=30`).
  If lists grow large later, revisit virtualization — out of scope here.
