# Card-Stack Inbox Review — Design Spec

**Date:** 2026-06-14
**Status:** Approved for implementation
**Scope:** Feature B of the "more user-friendly" effort. (Feature A = Capture
polish, shipped. Tab-swiping was dropped.)

## Goal

Add a Tinder-style full-screen reviewer for the Inbox: one expense card at a
time, swipe **right to Approve** / **left to Reject**, with Undo. It makes
clearing the review queue fast and tactile, building on the swipe gesture
infrastructure already shipped.

## Decisions (locked during brainstorming)

- **Entry:** a "Review N" button on the Inbox opens a dedicated full-screen
  route. The Inbox list stays for browsing.
- **Scope of the deck:** only actionable items — `review_status === "diff_found"`
  (the same items that show Approve/Reject in the Inbox list today).
- **Gestures:** right = Approve, left = Reject, tap = open detail, plus an Undo
  control. Approve/Reject/Undo also available as buttons (the accessible path).
- **Build approach:** hand-rolled with the already-installed
  `react-native-gesture-handler` + `react-native-reanimated` (mirrors the shipped
  `SwipeableRow`). No deck-swiper dependency — avoids reanimated-4 compat risk.
- **Commit model:** decisions are **staged locally**; the server is updated once
  on exit (finish or close). Undo pops the last staged decision. Force-quitting
  mid-review sends nothing — those items remain reviewable.

## Background / current state

- Inbox (`apps/expenses/app/(tabs)/inbox.tsx`) lists expenses; reviewable ones
  are `review_status === "diff_found"` and call `expensesApi.acceptReview(id)` /
  `rejectReview(id)`. The inbox query key is `["expenses", "inbox"]`.
- `expensesApi.getExpenses()` returns list items
  (`id, amount, currency, expense_date, category, vendor, analysis_status,
  review_status, attachments_count`).
- Detail route `app/expense/[id]` already exists for full detail.
- `react-native-gesture-handler` 2.28 and `react-native-reanimated` 4.x are
  installed; the root is wrapped in `GestureHandlerRootView`. `expo-haptics` is
  installed. `SwipeableRow` already demonstrates the gesture/animation pattern.
- **Shim convention (CLAUDE.md):** the workspace-root `app/` mirrors
  `apps/expenses/app/*` via re-export shims so `expo run` works from the root.
  A new screen needs a matching root shim.

## Architecture

### Files

| File | Responsibility | Action |
|------|----------------|--------|
| `apps/expenses/app/review.tsx` | Full-screen reviewer: owns deck/index/staged decisions, progress, completion, commit-on-exit | Create |
| `app/review.tsx` (workspace root) | Re-export shim → `../apps/expenses/app/review` | Create |
| `apps/expenses/src/components/SwipeCard.tsx` | One draggable card: pan+fling, overlay labels, imperative `swipe()` | Create |
| `apps/expenses/app/(tabs)/inbox.tsx` | "Review N" button → `router.push("/review")` | Modify |

### `SwipeCard` component

- **Props:**
  ```ts
  type SwipeCardItem = {
    id: number; amount: number; currency: string; vendor?: string | null;
    category: string; expense_date: string;
  };
  type SwipeCardProps = {
    item: SwipeCardItem;
    onDecision: (decision: "approve" | "reject") => void;
    onOpenDetail: () => void;
  };
  type SwipeCardHandle = { swipe: (decision: "approve" | "reject") => void };
  ```
  (`SwipeCard` is wrapped in `forwardRef<SwipeCardHandle, SwipeCardProps>`.)
- Built on `Gesture.Pan()` (gesture-handler) + reanimated `useSharedValue`
  (`translateX`, `translateY`) and `useAnimatedStyle` (translate + a small
  rotation derived from `translateX`).
- On pan end: if `|translateX|` exceeds a threshold (e.g. 35% of screen width)
  or horizontal velocity is high, animate the card off-screen in that direction
  (`withTiming`) and then call `onDecision` ("approve" for right, "reject" for
  left); otherwise spring `translateX/Y` back to 0.
- Overlay labels "APPROVE" (green) and "REJECT" (red) whose opacity is driven by
  `translateX` (positive → approve, negative → reject).
- A composed tap gesture (`Gesture.Tap`, raced/exclusive with Pan) calls
  `onOpenDetail`.
- `useImperativeHandle` exposes `swipe(decision)` which runs the same off-screen
  fling animation then `onDecision` — so the on-screen buttons animate identically.
- A light haptic (`expo-haptics`) fires when a decision commits (threshold
  crossed), fire-and-forget.

### `review.tsx` screen

- **Header:** hidden via `Stack.Screen options={{ headerShown: false }}`; a custom
  top bar with a close ✕ (left) and progress "index+1 of total" (center/right).
- **Deck snapshot:** on first successful load, capture
  `getExpenses()` items filtered to `review_status === "diff_found"` into local
  `deck` state (so the in-flight cache can't reshuffle the order). Uses the same
  `useQuery({ queryKey: ["expenses", "inbox"] })` to reuse the cache.
- **State:** `deck: SwipeCardItem[]`, `index: number`,
  `decisions: { id: number; decision: "approve" | "reject" }[]`,
  `committing: boolean`.
- **Render:**
  - If `index < deck.length`: the **peeking card** (`deck[index+1]`, static,
    slightly scaled/translated, no gestures) behind the **top card**
    (`SwipeCard` for `deck[index]`, with the ref). Below: Reject / Undo / Approve
    buttons. Reject/Approve call `topCardRef.current?.swipe(...)`; Undo is enabled
    when `decisions.length > 0`.
  - If `index >= deck.length`: the **completion view** — a summary
    ("Reviewed N · X approved, Y rejected"), an Undo button, and a **Done** button.
- **handleDecision(decision):** push `{ id: deck[index].id, decision }` onto
  `decisions`, increment `index`. (Called from `SwipeCard.onDecision`.)
- **handleUndo():** if `decisions` non-empty, pop the last decision and
  decrement `index` (returns to that card; works from the completion view too).
- **commitAndExit():** set `committing`, run
  `Promise.allSettled(decisions.map(d => d.decision === "approve"
  ? acceptReview(d.id) : rejectReview(d.id)))`, then
  `queryClient.invalidateQueries({ queryKey: ["expenses"] })`, then
  `router.back()`. Called by both Done and the close ✕. If `decisions` is empty,
  skip the network and just `router.back()`.
- **Empty guard:** if the snapshot deck is empty (e.g. navigated directly), show
  a brief "Nothing to review" state with a back button.

### Inbox "Review N" button

- Compute `reviewCount` = items with `review_status === "diff_found"` (the screen
  already computes `reviewCount` for its summary tiles — reuse it).
- Render a primary button in the header card, only when `reviewCount > 0`, label
  "Review N" (N = count), `onPress={() => router.push("/review")}`.

## Data flow

- No mutation fires until `commitAndExit()`. Staged decisions live only in
  `review.tsx` state. On commit, the existing `acceptReview`/`rejectReview`
  endpoints run, then a single `invalidateQueries(["expenses"])` refreshes Inbox,
  Timeline, and Insights.

## Error handling

- `commitAndExit` uses `Promise.allSettled`; count rejected results. If any
  failed, surface a count (the inbox refetch will show the true remaining items,
  so failed ones simply stay reviewable). Successful navigation still occurs.
- Opening detail mid-review pushes `/expense/[id]` over the (still-mounted)
  reviewer, so review state is preserved when the user returns.

## Accessibility

- Swipe isn't screen-reader-friendly, so **Approve / Reject / Undo buttons** are
  the accessible path; each has a clear `accessibilityRole`/`accessibilityLabel`.
- The card carries an `accessibilityLabel` summarizing amount/vendor/category/date.
- Overlay swipe labels are decorative (`importantForAccessibility="no-hide-descendants"`).

## Testing & verification

No test harness (per CLAUDE.md). Gate on `npx tsc --noEmit` (from `apps/expenses`)
plus manual checks:
- Inbox shows "Review N" only when there are reviewable items; tapping opens the
  reviewer.
- Swipe right approves, left rejects; card flings off and the next appears; the
  peeking card is visible behind.
- Approve/Reject buttons animate the same fling; Undo steps back and restores the
  card (including from the completion view).
- Finishing the deck shows the summary with correct counts; Done commits.
- Close ✕ mid-deck commits decisions made so far.
- Verify (via network logs) that NO accept/reject calls fire until exit, then all
  staged decisions fire once; Inbox reflects them after.
- Tap a card → opens `/expense/[id]`; back returns to the reviewer mid-deck.
- Native rebuild not required (gesture/reanimated/haptics already built), but a
  full reload is.

## Risks / notes

- **Order stability:** snapshot the deck once; do not re-derive from the query
  after mutations, or the list would shift. (Mutations only fire on exit anyway,
  but the snapshot is the guarantee.)
- **Imperative fling vs unmount:** when a card flings off and `index` advances,
  the old `SwipeCard` unmounts; ensure its animation completes/cleans up (drive
  `onDecision` from the animation completion callback).
- **Root shim:** don't forget `app/review.tsx` at the workspace root, or
  `expo run` from the root won't find the screen.
- **Gesture composition:** Pan + Tap must be composed (`Gesture.Exclusive`/`Race`)
  so a tap doesn't register as a zero-distance swipe.
