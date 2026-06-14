# Swipeable Rows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add horizontal swipe actions to the expenses app — Inbox rows swipe right to Approve / left to Reject, Timeline rows swipe left to Delete (with an undo window).

**Architecture:** Install gesture-handler + reanimated + haptics and enable them at the app root. Build one reusable `SwipeableRow` component and one reusable `UndoToast`, then wire them into the existing Inbox and Timeline screens with optimistic React Query updates. No backend changes — the approve/reject/delete endpoints already exist in `api.ts`.

**Tech Stack:** Expo SDK 54, React Native 0.81, expo-router 5, `react-native-gesture-handler` (`ReanimatedSwipeable`), `react-native-reanimated`, `expo-haptics`, `@tanstack/react-query`.

---

## Testing note

This repo has **no unit-test harness** (per CLAUDE.md) and adding one for native gesture components is out of scope. Each task's verification gate is therefore:

1. `npx tsc --noEmit` (run from `apps/expenses`) — must report no errors.
2. A concrete **manual check** on a running build.

Because tasks 2–5 add or use **native modules**, a JS-only Metro reload is not enough — manual checks require a native rebuild (`npm run ios:expenses` or `android:expenses`) at least once after Task 1.

## File structure

| File | Responsibility | Action |
|------|----------------|--------|
| `apps/expenses/package.json` | Declares the new native deps | Modify (via `expo install`) |
| `apps/expenses/babel.config.js` | Adds the Reanimated/Worklets Babel plugin (must be last) | Modify |
| `apps/expenses/app/_layout.tsx` | Wraps the app tree in `GestureHandlerRootView` | Modify |
| `apps/expenses/src/components/SwipeableRow.tsx` | Reusable swipe-to-act row wrapper | Create |
| `apps/expenses/src/components/UndoToast.tsx` | Reusable controlled undo banner | Create |
| `apps/expenses/app/(tabs)/inbox.tsx` | Wires swipe approve/reject + optimistic removal | Modify |
| `apps/expenses/app/(tabs)/timeline.tsx` | Wires swipe-to-delete + deferred delete + undo | Modify |

---

## Task 1: Foundation — install deps, Babel plugin, root provider

**Files:**
- Modify: `apps/expenses/package.json` (via CLI)
- Modify: `apps/expenses/babel.config.js`
- Modify: `apps/expenses/app/_layout.tsx`

- [ ] **Step 1: Install native dependencies**

Run from `apps/expenses`:
```bash
npx expo install react-native-gesture-handler react-native-reanimated expo-haptics
```

- [ ] **Step 2: Determine the Reanimated major version**

Run from `apps/expenses`:
```bash
node -p "require('./node_modules/react-native-reanimated/package.json').version"
```

- If it prints **4.x**: also install worklets and use its plugin:
  ```bash
  npx expo install react-native-worklets
  ```
  Babel plugin name will be `react-native-worklets/plugin`.
- If it prints **3.x**: no extra install; Babel plugin name will be
  `react-native-reanimated/plugin`.

- [ ] **Step 3: Add the Babel plugin (must be LAST in the plugins array)**

Edit `apps/expenses/babel.config.js`. Replace the whole file with (use the
plugin name resolved in Step 2 — shown here for Reanimated v4 / worklets):

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["expo-router/babel", "react-native-worklets/plugin"],
  };
};
```

If Step 2 reported Reanimated 3.x, use `"react-native-reanimated/plugin"`
instead of `"react-native-worklets/plugin"`. The reanimated/worklets plugin
MUST be the last entry or worklets fail silently.

> Note: if the native build later errors specifically about
> `expo-router/babel` being unsupported on this SDK, remove that string —
> `babel-preset-expo` already covers expo-router. Leave it otherwise.

- [ ] **Step 4: Wrap the root layout in `GestureHandlerRootView`**

Edit `apps/expenses/app/_layout.tsx`. Add the import and wrap the returned
tree. The full updated `return` block and import:

Add to the import block near the top:
```tsx
import { GestureHandlerRootView } from "react-native-gesture-handler";
```

Replace the existing `return (...)` with:
```tsx
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
```

- [ ] **Step 5: Verify types**

Run from `apps/expenses`:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Verify the app still boots (native rebuild)**

Run from the workspace root:
```bash
npm run ios:expenses
```
Expected: app launches to its normal first screen with no red-screen
"native module not found" / "Reanimated plugin" errors. Navigate to Inbox and
Timeline — they look unchanged (no swipe yet).

- [ ] **Step 7: Commit**

```bash
git add apps/expenses/package.json apps/expenses/babel.config.js apps/expenses/app/_layout.tsx package-lock.json
git commit -m "chore(gestures): add gesture-handler, reanimated, haptics + root provider"
```

---

## Task 2: `SwipeableRow` component

**Files:**
- Create: `apps/expenses/src/components/SwipeableRow.tsx`

- [ ] **Step 1: Create the component**

Create `apps/expenses/src/components/SwipeableRow.tsx` with exactly:

```tsx
import { useRef } from "react";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

export type SwipeAction = {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  onTrigger: () => void;
};

type SwipeableRowProps = {
  children: ReactNode;
  leftAction?: SwipeAction; // revealed by swiping the row to the RIGHT
  rightAction?: SwipeAction; // revealed by swiping the row to the LEFT
  disabled?: boolean;
  triggerOnOpen?: boolean; // act as soon as the row is flung open
};

function ActionPanel({
  action,
  align,
  onPress,
}: {
  action: SwipeAction;
  align: "flex-start" | "flex-end";
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      onPress={onPress}
      style={[styles.panel, { backgroundColor: action.color, alignItems: align }]}
    >
      <View style={styles.panelInner}>
        <Feather name={action.icon} size={22} color="#ffffff" />
        <Text style={styles.panelLabel}>{action.label}</Text>
      </View>
    </Pressable>
  );
}

export function SwipeableRow({
  children,
  leftAction,
  rightAction,
  disabled,
  triggerOnOpen,
}: SwipeableRowProps) {
  const ref = useRef<SwipeableMethods>(null);

  if (disabled || (!leftAction && !rightAction)) {
    return <>{children}</>;
  }

  const fire = (action: SwipeAction) => {
    ref.current?.close();
    action.onTrigger();
  };

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      leftThreshold={72}
      rightThreshold={72}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={
        leftAction
          ? () => (
              <ActionPanel
                action={leftAction}
                align="flex-start"
                onPress={() => fire(leftAction)}
              />
            )
          : undefined
      }
      renderRightActions={
        rightAction
          ? () => (
              <ActionPanel
                action={rightAction}
                align="flex-end"
                onPress={() => fire(rightAction)}
              />
            )
          : undefined
      }
      onSwipeableWillOpen={() => {
        Haptics.selectionAsync();
      }}
      onSwipeableOpen={(direction) => {
        if (!triggerOnOpen) return;
        const action = direction === "left" ? leftAction : rightAction;
        if (action) fire(action);
      }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    borderRadius: 18,
  },
  panelInner: {
    alignItems: "center",
    gap: 4,
  },
  panelLabel: {
    color: "#ffffff",
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
  },
});
```

> Semantics reminder: in gesture-handler, dragging the row **right** reveals
> the **left** actions and fires `onSwipeableOpen("left")`. So `leftAction` =
> "swipe right", `rightAction` = "swipe left".

- [ ] **Step 2: Verify types**

Run from `apps/expenses`:
```bash
npx tsc --noEmit
```
Expected: no errors. (If `ReanimatedSwipeable`'s import path errors, confirm
gesture-handler installed in Task 1; the subpath
`react-native-gesture-handler/ReanimatedSwipeable` is correct for v2.)

- [ ] **Step 3: Commit**

```bash
git add apps/expenses/src/components/SwipeableRow.tsx
git commit -m "feat(gestures): reusable SwipeableRow component"
```

---

## Task 3: `UndoToast` component

**Files:**
- Create: `apps/expenses/src/components/UndoToast.tsx`

- [ ] **Step 1: Create the component**

Create `apps/expenses/src/components/UndoToast.tsx` with exactly:

```tsx
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type UndoToastProps = {
  visible: boolean;
  message: string;
  onUndo: () => void;
};

export function UndoToast({ visible, message, onUndo }: UndoToastProps) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInDown}
      exiting={FadeOutDown}
      style={[styles.toast, { bottom: insets.bottom + 90 }]}
    >
      <Text style={styles.message} numberOfLines={1}>
        {message}
      </Text>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={onUndo}>
        <Text style={styles.undo}>Undo</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#0F172A",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  message: {
    flex: 1,
    color: "#ffffff",
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
  },
  undo: {
    color: "#34d399",
    fontFamily: "Outfit_700Bold",
    fontSize: 14,
  },
});
```

> This is a **controlled** component — it owns no timer. The parent decides
> when `visible` flips false (when its deferred-delete timer fires or Undo is
> pressed). This keeps a single source of truth for timing.

- [ ] **Step 2: Verify types**

Run from `apps/expenses`:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/expenses/src/components/UndoToast.tsx
git commit -m "feat(gestures): reusable UndoToast banner"
```

---

## Task 4: Inbox — swipe to approve/reject with optimistic removal

**Files:**
- Modify: `apps/expenses/app/(tabs)/inbox.tsx`

- [ ] **Step 1: Import `SwipeableRow`**

Add to the imports at the top of `inbox.tsx`:
```tsx
import { SwipeableRow } from "../../src/components/SwipeableRow";
```

- [ ] **Step 2: Make approve/reject optimistic**

Replace the existing `approveMutation` and `rejectMutation` definitions
(currently `useMutation({ mutationFn..., onSettled... })`) with:

```tsx
  const approveMutation = useMutation({
    mutationFn: (id: number) => expensesApi.acceptReview(id),
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: ["expenses", "inbox"] });
      const previous = queryClient.getQueryData(["expenses", "inbox"]);
      queryClient.setQueryData(["expenses", "inbox"], (old: any) =>
        old ? { ...old, expenses: old.expenses.filter((e: any) => e.id !== id) } : old
      );
      return { previous };
    },
    onError: (_err, _id, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["expenses", "inbox"], context.previous);
      }
    },
    onSettled: () => {
      setPendingId(null);
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => expensesApi.rejectReview(id),
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: ["expenses", "inbox"] });
      const previous = queryClient.getQueryData(["expenses", "inbox"]);
      queryClient.setQueryData(["expenses", "inbox"], (old: any) =>
        old ? { ...old, expenses: old.expenses.filter((e: any) => e.id !== id) } : old
      );
      return { previous };
    },
    onError: (_err, _id, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["expenses", "inbox"], context.previous);
      }
    },
    onSettled: () => {
      setPendingId(null);
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
```

- [ ] **Step 3: Wrap each row in `SwipeableRow`**

In the `items.map((item) => { ... })` block, the body currently returns a
`<Pressable key={item.id} ...>...</Pressable>`. Wrap that `Pressable` in a
`SwipeableRow`. Remove the `key={item.id}` from the `Pressable` and put it on
the `SwipeableRow`. The returned JSX becomes:

```tsx
            return (
              <SwipeableRow
                key={item.id}
                disabled={!isReviewable}
                triggerOnOpen
                leftAction={
                  isReviewable
                    ? {
                        label: "Approve",
                        icon: "check",
                        color: "#059669",
                        onTrigger: () => {
                          setPendingId(item.id);
                          approveMutation.mutate(item.id);
                        },
                      }
                    : undefined
                }
                rightAction={
                  isReviewable
                    ? {
                        label: "Reject",
                        icon: "x",
                        color: "#dc2626",
                        onTrigger: () => {
                          setPendingId(item.id);
                          rejectMutation.mutate(item.id);
                        },
                      }
                    : undefined
                }
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open expense ${item.vendor ?? item.category}`}
                  onPress={() => router.push(`/expense/${item.id}` as never)}
                  style={({ pressed }) => [styles.cardColumn, pressed && styles.cardPressed]}
                >
```

Leave everything inside the `Pressable` (the card content and the existing
inline Approve/Reject `actionRow`) unchanged, and leave its closing
`</Pressable>` in place — only add a `</SwipeableRow>` right after it.

- [ ] **Step 4: Verify types**

Run from `apps/expenses`:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Manual check (native build running)**

On the Inbox screen with at least one "Review changes" card:
- Swipe a reviewable card **right** → it approves, animates out, queue counts
  update. Swipe another **left** → it rejects and animates out.
- A non-reviewable card (e.g. "Processing") does **not** swipe.
- The inline **Approve**/**Reject** buttons still work by tapping.
- A light haptic tick fires as the swipe crosses the threshold.

- [ ] **Step 6: Commit**

```bash
git add apps/expenses/app/(tabs)/inbox.tsx
git commit -m "feat(inbox): swipe right to approve, left to reject"
```

---

## Task 5: Timeline — swipe to delete with deferred delete + undo

**Files:**
- Modify: `apps/expenses/app/(tabs)/timeline.tsx`

- [ ] **Step 1: Add imports and hooks**

Add to the imports at the top of `timeline.tsx`:
```tsx
import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SwipeableRow } from "../../src/components/SwipeableRow";
import { UndoToast } from "../../src/components/UndoToast";
import type { ExpenseListItem } from "../../src/lib/api";
```

> Note: `useMemo`/`useState` are already imported from `react` on line 1 —
> merge `useEffect, useRef` into that existing import rather than duplicating
> the line. `useQuery` is already imported from react-query — add
> `useMutation, useQueryClient` to that existing import line.

- [ ] **Step 2: Add deferred-delete state and handlers**

Inside `TimelineScreen`, after the existing `const query = useQuery({...})`
block, add:

```tsx
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<ExpenseListItem | null>(null);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => expensesApi.deleteExpense(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const commitDelete = (item: ExpenseListItem) => {
    deleteMutation.mutate(item.id);
  };

  const requestDelete = (item: ExpenseListItem) => {
    // If a delete is already pending, commit it now before starting a new one.
    if (pendingDelete && deleteTimer.current) {
      clearTimeout(deleteTimer.current);
      commitDelete(pendingDelete);
    }
    setPendingDelete(item);
    deleteTimer.current = setTimeout(() => {
      commitDelete(item);
      deleteTimer.current = null;
      setPendingDelete(null);
    }, 4000);
  };

  const undoDelete = () => {
    if (deleteTimer.current) {
      clearTimeout(deleteTimer.current);
      deleteTimer.current = null;
    }
    setPendingDelete(null);
  };

  useEffect(() => {
    return () => {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
    };
  }, []);
```

- [ ] **Step 3: Hide the pending-delete row from the list**

The screen derives `expenses` via `useMemo`. After that memo, the rendered
list should exclude the row being deleted. Update the `.map` source by adding a
filter. Find the `expenses.map((item) => (` line and change it to:

```tsx
          expenses
            .filter((item) => item.id !== pendingDelete?.id)
            .map((item) => (
```

(Adjust the corresponding closing `)` of the map if your formatter reflows it —
the JSX body of the map is unchanged in this step.)

- [ ] **Step 4: Wrap each row in `SwipeableRow`**

The map body currently returns `<Pressable key={item.id} ...>...</Pressable>`.
Wrap it in a `SwipeableRow` (move `key` to the wrapper). Replace the opening of
the returned element:

```tsx
            <SwipeableRow
              key={item.id}
              rightAction={{
                label: "Delete",
                icon: "trash-2",
                color: "#dc2626",
                onTrigger: () => requestDelete(item),
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open expense ${item.vendor ?? item.category}`}
                onPress={() => router.push(`/expense/${item.id}` as never)}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              >
```

Leave the card's inner content and its closing `</Pressable>` unchanged; add a
matching `</SwipeableRow>` immediately after the `</Pressable>`.

> No `triggerOnOpen` here: swiping left reveals the red **Delete** panel and
> the user taps it to delete (matches the spec's "reveal a Delete button").

- [ ] **Step 5: Render the `UndoToast`**

The screen returns `<SafeAreaView ...><ScrollView ...>...</ScrollView>`. Add the
toast as a sibling of the `ScrollView`, inside `SafeAreaView`, right before the
closing `</SafeAreaView>`:

```tsx
        <UndoToast
          visible={Boolean(pendingDelete)}
          message="Expense deleted"
          onUndo={undoDelete}
        />
      </SafeAreaView>
```

- [ ] **Step 6: Verify types**

Run from `apps/expenses`:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Manual check (native build running)**

On the Timeline screen with at least one expense:
- Swipe a row **left** → a red **Delete** panel appears; tap it → the row
  disappears and the "Expense deleted" toast shows with **Undo**.
- Tap **Undo** within ~4s → the row returns; confirm via network logs that
  **no** `DELETE /expenses/:id` request was sent.
- Trigger a delete and let the toast expire (~4s) → the row stays gone and a
  `DELETE` request fires; the list refetches.
- Swipe-delete two rows quickly → the first commits (its `DELETE` fires) when
  the second starts; the second shows the toast.

- [ ] **Step 8: Commit**

```bash
git add apps/expenses/app/(tabs)/timeline.tsx
git commit -m "feat(timeline): swipe left to delete with undo window"
```

---

## Final verification

- [ ] **Run the type check once more from `apps/expenses`:**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Full manual smoke (native build):** repeat the Task 4 and Task 5
  manual checks end to end, then background/foreground the app to confirm no
  crashes and the tab bar / existing screens are unaffected.

- [ ] **Confirm the branch is clean:**

```bash
git status
```
Expected: nothing uncommitted (all task commits made on `feat/swipeable-rows`).

## Spec coverage check

- Foundation (deps, babel plugin, GestureHandlerRootView) → Task 1 ✅
- Shared `SwipeableRow` (interface, panels, haptics, disabled, tap-through) → Task 2 ✅
- Inbox swipe right=Approve / left=Reject, non-actionable disabled, inline buttons kept, optimistic + revert → Task 4 ✅
- Timeline swipe left=Delete, deferred delete, undo restores without API call → Task 5 ✅
- `UndoToast` reusable controlled banner → Task 3 ✅
- Error handling (revert on failure) → Tasks 4 & 5 ✅
- Accessibility (inline buttons retained, labeled panels) → Tasks 2 & 4 ✅
- Verification via `tsc --noEmit` + manual (no test harness) → every task ✅
- Out of scope (card-stack, tab-swipe) → not planned, by design ✅
