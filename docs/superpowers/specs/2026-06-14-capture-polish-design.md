# Capture Screen Polish — Design Spec

**Date:** 2026-06-14
**Status:** Approved for implementation
**Scope:** Feature A of the "more user-friendly" effort. (Feature B = card-stack review, to follow. Tab-swiping was dropped — it conflicts with the shipped row-swipes and needs a navigator rewrite.)

## Goal

Make the Capture tab fit on one screen and remove confusing duplicate actions,
while adding tactile feedback. Today the hero card is tall enough to push the
"Receipt scan" section below the fold, and the hero's "Scan receipt" /
"Record voice" buttons duplicate the "Open camera" / "Parse draft" buttons in
the sections beneath them.

## Non-goals

- No changes to the capture flows themselves (voice recording/transcribe/parse/save,
  receipt photo/create/upload). The API calls and both state machines are
  preserved exactly.
- No new shared UI package. The segmented control stays local to this screen
  (the project has no shared UI primitives yet; YAGNI until a second screen
  needs it).

## Background / current state

`apps/expenses/app/(tabs)/capture.tsx` is one self-contained screen with:
- A tall gradient **hero card** (28px two-line title + subtitle + two 56px
  action buttons: "Scan receipt", "Record voice").
- A **Voice section** (textarea + "Parse draft" + draft preview + Save).
- A **Receipt section** (camera button + image preview + Upload/Discard + status).
- A **session footer** at the very bottom (email + "Sign out").

State already cleanly separates voice (`voicePhase`, `transcript`, `voiceDraft`,
`recordingSeconds`, refs) from receipt (`receiptPhase`, `receiptUri`, etc.).
`expo-haptics` and `react-native-reanimated` are already installed (added in the
swipe-gestures work).

## Architecture

Single file, restructured around a new `mode` state. No new files.

### 1. Mode state + segmented control

- Add `const [mode, setMode] = useState<"receipt" | "voice">("receipt");`
  (default **Receipt**, matching today's button ordering).
- A small **inline** `SegmentedControl` (two pills: Receipt | Voice) rendered
  under the hero. Selecting a segment sets `mode`. Only the active panel renders
  below it.
- The control is **disabled while a flow is busy** so in-progress work can't be
  abandoned by switching tabs. "Busy" =
  `voicePhase` ∈ {`recording`, `transcribing`, `saving`} OR
  `receiptPhase` ∈ {`uploading`}.

### 2. Slim hero

- One-line title "Capture in seconds", condensed one-line subtitle, reduced
  vertical padding.
- **Remove** the two large hero action buttons (`heroAction*`). Each panel owns
  its own primary CTA instead (see below), which removes the duplication.
- Move the **email + Sign out** into the hero's top-right (small, right-aligned).
- **Remove** the bottom `sessionRow` footer (now redundant).

### 3. Receipt panel (shown when `mode === "receipt"`)

Same content/flow as today's Receipt section, but with a prominent primary CTA
at the top of the panel:
- Idle: a primary "Scan receipt" button (calls `handlePickReceipt`).
- Previewing: image preview + "Upload & save" / "Discard".
- Uploading: spinner row.
- Done: success banner (subject to auto-reset, below).
- Errors render in-panel as today.

### 4. Voice panel (shown when `mode === "voice"`)

Same content/flow as today's Voice section, but with the primary record CTA
inside the panel:
- A prominent **Record voice** button (calls `handleToggleRecording`); while
  recording it shows "Stop recording  m:ss" with the pulse (below).
- The "or type a description" **textarea** + **Parse draft** button (the typed
  fallback) remain.
- Draft preview + **Save expense** remain.
- Saved: success banner (subject to auto-reset).

### 5. Polish — haptics

Use `expo-haptics` (already installed). Fire:
- `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` on record start,
  record stop, and scan-receipt tap.
- `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` when a
  voice expense saves (`voicePhase → saved`) and when a receipt upload completes
  (`receiptPhase → done`).
- All haptic calls are fire-and-forget (`.catch(() => {})` or `void`), no-ops on
  unsupported hardware / simulator.

### 6. Polish — recording pulse

- While `voicePhase === "recording"`, render a reanimated **pulsing ring**
  (scale + fade loop) around/behind the record control to make the active state
  obvious, alongside the `m:ss` timer (made more prominent).
- Implemented with `react-native-reanimated` (`useSharedValue` +
  `withRepeat(withTiming(...))` + `useAnimatedStyle`). The animation starts when
  recording begins and stops/resets when it ends (drive it off `voicePhase`
  via an effect, or conditionally mount the animated view so it cleans up).

### 7. Polish — success auto-reset

- After a successful save (`voicePhase === "saved"`) or upload
  (`receiptPhase === "done"`), start a ~2500ms timer that calls the existing
  `resetVoice()` / `resetReceipt()` to return the panel to idle.
- Track timers in refs; clear them on unmount and when the user manually acts or
  switches `mode`, to avoid a reset firing over new work.

## Data flow

Unchanged. `mode` and the reset timers are pure view-state. All network calls
(`expensesApi.transcribeAudio`, `parseVoice`, `createExpense`, `uploadReceipt`)
and their `queryClient.invalidateQueries({ queryKey: ["expenses"] })` calls are
exactly as today.

## Error handling

Unchanged. `voiceError` / `receiptError` still render within the active panel.
A flow that errors returns to a non-busy phase, which also re-enables the
segmented control.

## Accessibility

- Segmented control: each segment is a `Pressable` with `accessibilityRole`
  `"button"`, an `accessibilityState={{ selected }}`, and a clear label
  ("Receipt capture" / "Voice capture").
- Primary CTAs keep their existing `accessibilityLabel`s.
- The pulse is decorative — mark it `accessibilityElementsHidden` /
  `importantForAccessibility="no-hide-descendants"` so it isn't announced.

## Testing & verification

No test harness in this repo (per CLAUDE.md). Gate each step on
`npx tsc --noEmit` (from `apps/expenses`) plus a manual checklist:
- Hero is slim; email + Sign out reachable in the hero; bottom footer gone.
- Segmented control switches panels; only the active panel shows; control is
  disabled mid-record / mid-upload.
- Receipt flow end-to-end (scan → preview → upload → success) still works.
- Voice flow end-to-end (record → transcribe → parse → save, AND typed → parse →
  save) still works.
- Haptics fire on a physical device (record start/stop, scan, save/upload success).
- Recording pulse animates while recording and stops afterward.
- Success banner auto-clears after ~2.5s; switching mode or acting cancels it.
- Native rebuild required (reanimated/haptics are native) — Metro reload alone
  won't reflect native module changes, though this screen's deps were already
  built in the swipe work.

## Risks / notes

- Reanimated pulse: ensure the animated value's repeat loop is cancelled when
  recording stops (conditional mount is the simplest guarantee).
- Auto-reset timers must be cleared on unmount and mode-switch to avoid a late
  reset wiping a freshly started capture.
- Keep the receipt/voice state machines untouched — only their presentation
  (which panel, which CTA placement) changes.
