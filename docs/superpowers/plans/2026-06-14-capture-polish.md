# Capture Screen Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Capture tab into a compact segmented (Receipt | Voice) layout with no duplicate actions, then add haptics, a recording pulse, and success auto-reset.

**Architecture:** All changes are in the single file `apps/expenses/app/(tabs)/capture.tsx`. The voice/receipt state machines and all API calls are untouched — only presentation, a new `mode` view-state, two small inline components, haptic calls, and reset/animation effects change.

**Tech Stack:** React Native 0.81, expo-router 5, `expo-haptics` (installed), `react-native-reanimated` 4.x (installed), `expo-av`, `expo-image-picker`, `expo-linear-gradient`.

---

## Testing note

No unit-test harness exists in this repo (per CLAUDE.md). Each task gates on:
1. `npx tsc --noEmit` from `apps/expenses` — no errors.
2. A manual check (the screen's native deps — reanimated/haptics — were already
   built during the swipe-gestures work, so a Metro reload reflects most changes;
   haptics still require a physical device to feel).

## File structure

| File | Responsibility | Action |
|------|----------------|--------|
| `apps/expenses/app/(tabs)/capture.tsx` | The entire Capture screen: state machines (unchanged), new `mode` state, inline `SegmentedControl` + `RecordingPulse`, slim hero, panels, polish effects | Modify (all 4 tasks) |

All four tasks modify this one file. They are ordered so the screen compiles and
works after every commit.

---

## Task 1: Segmented layout restructure

Replaces the tall hero + stacked sections with a slim hero, a Receipt|Voice
segmented control, and one visible panel at a time. Removes duplicate buttons
and the bottom session footer; moves Sign out into the hero.

**Files:**
- Modify: `apps/expenses/app/(tabs)/capture.tsx`

- [ ] **Step 1: Add the `mode` state and derived busy flags**

In `CaptureScreen`, find the existing render-helper section near the bottom of
the component (the lines defining `isVoiceBusy` and `canScanReceipt`, currently
~247–248):

```tsx
  const isVoiceBusy = voicePhase === "transcribing" || voicePhase === "saving";
  const canScanReceipt = receiptPhase === "idle" || receiptPhase === "done";
```

Replace those two lines with:

```tsx
  const isVoiceBusy = voicePhase === "transcribing" || voicePhase === "saving";
  const isReceiptBusy = receiptPhase === "uploading";
  const switchLocked = voicePhase === "recording" || isVoiceBusy || isReceiptBusy;
```

(`canScanReceipt` is removed — the receipt panel computes its own button visibility.)

Then add the `mode` state alongside the other `useState` calls. Put this line
immediately after the `const queryClient = useQueryClient();` line (~26):

```tsx
  const [mode, setMode] = useState<"receipt" | "voice">("receipt");
```

- [ ] **Step 2: Add the inline `SegmentedControl` component**

At the top level of the file (NOT inside `CaptureScreen`), directly above
`export default function CaptureScreen() {`, add:

```tsx
function SegmentedControl({
  value,
  onChange,
  disabled,
}: {
  value: "receipt" | "voice";
  onChange: (next: "receipt" | "voice") => void;
  disabled?: boolean;
}) {
  const segments: { key: "receipt" | "voice"; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: "receipt", label: "Receipt", icon: "camera" },
    { key: "voice", label: "Voice", icon: "mic" },
  ];
  return (
    <View style={[styles.segment, disabled && styles.buttonDisabled]}>
      {segments.map((seg) => {
        const active = seg.key === value;
        return (
          <Pressable
            key={seg.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: Boolean(disabled) }}
            accessibilityLabel={`${seg.label} capture`}
            disabled={disabled}
            onPress={() => onChange(seg.key)}
            style={[styles.segmentItem, active && styles.segmentItemActive]}
          >
            <Feather name={seg.icon} size={16} color={active ? "#ffffff" : "#64748b"} />
            <Text style={[styles.segmentText, active ? styles.segmentTextActive : styles.segmentTextInactive]}>
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 3: Replace the entire `return (...)` block**

Replace the whole JSX `return ( ... );` in `CaptureScreen` (currently ~250–475,
from `return (` through the matching `);` before the closing `}` of the
component) with EXACTLY:

```tsx
  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── Slim hero ── */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={["#10b981", "#059669"]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.heroTopRow}>
            <Text style={styles.heroTitle} numberOfLines={1}>Capture in seconds</Text>
            <Pressable onPress={logout} hitSlop={10} accessibilityRole="button" accessibilityLabel="Sign out">
              <Text style={styles.heroSignOut}>Sign out</Text>
            </Pressable>
          </View>
          <Text style={styles.heroBody} numberOfLines={1}>
            {user?.email ?? "Speak an expense or snap a receipt."}
          </Text>
        </View>

        {/* ── Mode switch ── */}
        <SegmentedControl value={mode} onChange={setMode} disabled={switchLocked} />

        {/* ── Receipt panel ── */}
        {mode === "receipt" && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Feather name="camera" size={16} color="#059669" />
                <Text style={styles.sectionTitle}>Receipt scan</Text>
              </View>
              <Text style={styles.sectionDescription}>
                Snap a photo — a draft expense is created and sent for OCR review.
              </Text>
            </View>

            {receiptUri && receiptPhase !== "idle" && (
              <Image source={{ uri: receiptUri }} style={styles.receiptPreview} resizeMode="cover" />
            )}

            {receiptError ? <Text style={styles.errorText}>{receiptError}</Text> : null}

            {(receiptPhase === "idle" || receiptPhase === "done") && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={receiptPhase === "done" ? "Scan another receipt" : "Scan receipt"}
                style={[styles.inlineBtn, styles.primaryBtn]}
                onPress={handlePickReceipt}
              >
                <Feather name="camera" size={16} color="#ffffff" />
                <Text style={styles.primaryBtnText}>
                  {receiptPhase === "done" ? "Scan another receipt" : "Scan receipt"}
                </Text>
              </Pressable>
            )}

            {receiptPhase === "previewing" && (
              <View style={styles.inlineRow}>
                <Pressable accessibilityRole="button" style={[styles.inlineBtn, styles.primaryBtn]} onPress={handleUploadReceipt}>
                  <Feather name="upload" size={15} color="#ffffff" />
                  <Text style={styles.primaryBtnText}>Upload & save</Text>
                </Pressable>
                <Pressable accessibilityRole="button" style={[styles.inlineBtn, styles.outlineBtn]} onPress={resetReceipt}>
                  <Text style={styles.outlineBtnText}>Discard</Text>
                </Pressable>
              </View>
            )}

            {receiptPhase === "uploading" && (
              <View style={styles.uploadingRow}>
                <ActivityIndicator color="#059669" />
                <Text style={styles.uploadingText}>Uploading receipt…</Text>
              </View>
            )}

            {receiptPhase === "done" && (
              <View style={styles.successBanner}>
                <Feather name="check-circle" size={18} color="#059669" />
                <Text style={styles.successText}>
                  Receipt uploaded — expense #{receiptExpenseId} queued for OCR
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Voice panel ── */}
        {mode === "voice" && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Feather name="mic" size={16} color="#059669" />
                <Text style={styles.sectionTitle}>Voice expense</Text>
              </View>
              <Text style={styles.sectionDescription}>
                Tap record, or type a description and tap Parse.
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={voicePhase === "recording" ? "Stop recording" : "Record voice expense"}
              style={[
                styles.inlineBtn,
                voicePhase === "recording" ? styles.recordBtnActive : styles.primaryBtn,
                isVoiceBusy && styles.buttonDisabled,
              ]}
              onPress={voicePhase === "saved" ? resetVoice : handleToggleRecording}
              disabled={isVoiceBusy}
            >
              {isVoiceBusy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Feather
                    name={voicePhase === "recording" ? "square" : voicePhase === "saved" ? "check-circle" : "mic"}
                    size={16}
                    color="#ffffff"
                  />
                  <Text style={styles.primaryBtnText}>
                    {voicePhase === "recording"
                      ? `Stop recording  ${fmtTime(recordingSeconds)}`
                      : voicePhase === "saved"
                      ? "Record another"
                      : "Record voice expense"}
                  </Text>
                </>
              )}
            </Pressable>

            <TextInput
              multiline
              numberOfLines={3}
              value={transcript}
              onChangeText={setTranscript}
              placeholder='e.g. "Spent $18 on lunch at Freshii today"'
              placeholderTextColor="#94a3b8"
              style={styles.textarea}
              editable={voicePhase !== "recording" && voicePhase !== "transcribing"}
            />

            {voicePhase !== "saved" && voicePhase !== "recording" && (
              <View style={styles.inlineRow}>
                <Pressable
                  accessibilityRole="button"
                  style={[
                    styles.inlineBtn,
                    styles.outlineBtn,
                    (isVoiceBusy || !transcript.trim()) && styles.buttonDisabled,
                  ]}
                  onPress={() => parseDraft()}
                  disabled={isVoiceBusy || !transcript.trim()}
                >
                  <Text style={styles.outlineBtnText}>
                    {voicePhase === "transcribing" ? "Parsing…" : "Parse draft"}
                  </Text>
                </Pressable>
              </View>
            )}

            {voiceError ? <Text style={styles.errorText}>{voiceError}</Text> : null}

            {voiceDraft && voicePhase !== "idle" && voicePhase !== "saved" && (
              <View style={styles.draftCard}>
                <View style={styles.draftRow}>
                  <Text style={styles.draftAmount}>
                    {voiceDraft.amount != null
                      ? `${voiceDraft.currency} ${voiceDraft.amount.toFixed(2)}`
                      : "Amount unknown"}
                  </Text>
                  <Text style={[styles.draftConfidence, { color: confidenceColor(voiceDraft.confidence) }]}>
                    {confidenceLabel(voiceDraft.confidence)}
                  </Text>
                </View>
                <Text style={styles.draftMeta}>
                  {[voiceDraft.category, voiceDraft.vendor, voiceDraft.expense_date]
                    .filter(Boolean)
                    .join("  ·  ")}
                </Text>
                <Text style={styles.draftParser}>
                  {voiceDraft.parser_used.toUpperCase()} · {Math.round(voiceDraft.confidence * 100)}%
                </Text>

                <Pressable
                  accessibilityRole="button"
                  style={[styles.inlineBtn, styles.primaryBtn, voicePhase === "saving" && styles.buttonDisabled]}
                  onPress={saveVoiceExpense}
                  disabled={voicePhase === "saving"}
                >
                  {voicePhase === "saving" ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Save expense</Text>
                  )}
                </Pressable>
              </View>
            )}

            {voicePhase === "saved" && (
              <View style={styles.successBanner}>
                <Feather name="check-circle" size={18} color="#059669" />
                <Text style={styles.successText}>Expense saved — visible in Timeline</Text>
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
```

- [ ] **Step 4: Update the StyleSheet**

In the `StyleSheet.create({ ... })` at the bottom:

(a) **Delete** these now-unused style keys entirely:
`heroAction`, `heroActionPrimary`, `heroActionSecondary`, `heroActionRecording`,
`heroActionPrimaryText`, `heroActionSecondaryText`, `sessionRow`, `sessionLabel`,
`signOut`.

(b) **Replace** the `heroCard`, `heroTitle`, and `heroBody` entries with:

```tsx
  heroCard: {
    borderRadius: 18,
    padding: 16,
    gap: 8,
    backgroundColor: "#10b981",
    shadowColor: "#cbd5e1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
    position: "relative",
    overflow: "hidden",
  },
  heroTitle: { fontFamily: "Outfit_700Bold", fontSize: 22, color: "#ffffff", flex: 1 },
  heroBody: { fontFamily: "Outfit_400Regular", fontSize: 13, lineHeight: 18, color: "#ecfdf5" },
```

(c) **Add** these new style keys (place them right after the `heroBody` entry):

```tsx
  heroTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  heroSignOut: { fontFamily: "Outfit_700Bold", fontSize: 13, color: "#ffffff" },
  segment: { flexDirection: "row", backgroundColor: "#eef2f6", borderRadius: 14, padding: 4, gap: 4 },
  segmentItem: {
    flex: 1, minHeight: 44, borderRadius: 11,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  segmentItemActive: { backgroundColor: "#059669" },
  segmentText: { fontFamily: "Outfit_600SemiBold", fontSize: 14 },
  segmentTextActive: { color: "#ffffff" },
  segmentTextInactive: { color: "#64748b" },
  recordBtnActive: { backgroundColor: "#ef4444" },
```

- [ ] **Step 5: Verify types**

Run from `apps/expenses`:
```bash
npx tsc --noEmit
```
Expected: no errors. (If tsc flags an unused variable like `canScanReceipt`,
confirm you removed its declaration in Step 1.)

- [ ] **Step 6: Manual check**

Reload the app, open Capture:
- Hero is a single slim card with the title and a **Sign out** link top-right;
  email shows on the second line; the old bottom footer is gone.
- A **Receipt | Voice** toggle sits under the hero; Receipt is selected by default.
- Only the selected panel shows. Receipt panel has a "Scan receipt" primary
  button; Voice panel has a "Record voice expense" primary button + textarea.
- Start a recording, then try tapping the toggle — it is disabled (greyed) until
  recording/processing ends.

- [ ] **Step 7: Commit**

```bash
git add "apps/expenses/app/(tabs)/capture.tsx"
git commit -m "feat(capture): segmented Receipt/Voice layout, slim hero, no duplicate actions"
```

---

## Task 2: Haptic feedback

**Files:**
- Modify: `apps/expenses/app/(tabs)/capture.tsx`

- [ ] **Step 1: Import expo-haptics**

Add this import near the other expo imports at the top (e.g. after the
`expo-linear-gradient` import):

```tsx
import * as Haptics from "expo-haptics";
```

- [ ] **Step 2: Haptic on record start**

In `startRecording`, immediately after `setVoicePhase("recording");`, add:

```tsx
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
```

- [ ] **Step 3: Haptic on record stop**

In `stopRecording`, add this as the FIRST statement inside the function (before
the `if (timerRef.current) {` block):

```tsx
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
```

- [ ] **Step 4: Haptic on scan tap**

In `handlePickReceipt`, add this as the FIRST statement inside the function
(before `setReceiptError("");`):

```tsx
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
```

- [ ] **Step 5: Success haptic on voice save**

In `saveVoiceExpense`, immediately after `setVoicePhase("saved");`, add:

```tsx
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
```

- [ ] **Step 6: Success haptic on receipt upload**

In `handleUploadReceipt`, immediately after `setReceiptPhase("done");`, add:

```tsx
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
```

- [ ] **Step 7: Verify types**

Run from `apps/expenses`:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 8: Manual check (physical device for feel; simulator just must not crash)**

On a physical device: feel a light tap when starting/stopping a recording and
when tapping Scan receipt; feel a success buzz when a voice expense saves and
when a receipt upload finishes. On the simulator, confirm no crash.

- [ ] **Step 9: Commit**

```bash
git add "apps/expenses/app/(tabs)/capture.tsx"
git commit -m "feat(capture): haptic feedback on capture actions"
```

---

## Task 3: Recording pulse

**Files:**
- Modify: `apps/expenses/app/(tabs)/capture.tsx`

- [ ] **Step 1: Import reanimated primitives**

Add this import near the top with the other imports:

```tsx
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from "react-native-reanimated";
```

- [ ] **Step 2: Add the `RecordingPulse` component**

At the top level of the file (NOT inside `CaptureScreen`), directly above
`function SegmentedControl(` (added in Task 1), add:

```tsx
function RecordingPulse() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.7);

  useEffect(() => {
    scale.value = withRepeat(withTiming(2.4, { duration: 1200 }), -1, false);
    opacity.value = withRepeat(withTiming(0, { duration: 1200 }), -1, false);
  }, [scale, opacity]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.pulseWrap} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.pulseRing, ringStyle]} />
      <View style={styles.pulseDot} />
    </View>
  );
}
```

(`useEffect` is already imported on line 1 of the file; `View` is already imported.)

- [ ] **Step 3: Render the recording row in the Voice panel**

In the Voice panel JSX, immediately AFTER the record `</Pressable>` (the
button whose label switches between "Record voice expense" / "Stop recording" /
"Record another") and BEFORE the `<TextInput`, insert:

```tsx
            {voicePhase === "recording" && (
              <View style={styles.recordingRow}>
                <RecordingPulse />
                <Text style={styles.recordingTimer}>{fmtTime(recordingSeconds)}</Text>
                <Text style={styles.recordingHint}>Listening…</Text>
              </View>
            )}
```

- [ ] **Step 4: Add pulse + recording-row styles**

In the StyleSheet, add these keys (e.g. after the `recordBtnActive` entry from
Task 1):

```tsx
  recordingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  recordingTimer: { fontFamily: "Outfit_700Bold", fontSize: 18, color: "#ef4444" },
  recordingHint: { fontFamily: "Outfit_500Medium", fontSize: 13, color: "#94a3b8" },
  pulseWrap: { width: 16, height: 16, alignItems: "center", justifyContent: "center" },
  pulseRing: { position: "absolute", width: 16, height: 16, borderRadius: 8, backgroundColor: "#ef4444" },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444" },
```

- [ ] **Step 5: Verify types**

Run from `apps/expenses`:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Manual check**

Switch to Voice, tap Record. While recording: a red dot with an expanding,
fading ring pulses next to a prominent red `m:ss` timer and "Listening…". When
you stop, the row disappears and the animation stops (no leftover animation,
no console warnings about running animations on unmounted views).

- [ ] **Step 7: Commit**

```bash
git add "apps/expenses/app/(tabs)/capture.tsx"
git commit -m "feat(capture): animated recording pulse + prominent timer"
```

---

## Task 4: Success auto-reset

**Files:**
- Modify: `apps/expenses/app/(tabs)/capture.tsx`

- [ ] **Step 1: Add the auto-reset effect**

Inside `CaptureScreen`, add a ref next to the other refs (after
`const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);`, ~35):

```tsx
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

Then add this effect immediately AFTER the existing cleanup `useEffect` (the one
that returns a function clearing `timerRef` and unloading the recording, ~45–50):

```tsx
  useEffect(() => {
    if (voicePhase === "saved" || receiptPhase === "done") {
      resetTimerRef.current = setTimeout(() => {
        if (voicePhase === "saved") resetVoice();
        if (receiptPhase === "done") resetReceipt();
      }, 2500);
      return () => {
        if (resetTimerRef.current) {
          clearTimeout(resetTimerRef.current);
          resetTimerRef.current = null;
        }
      };
    }
  }, [voicePhase, receiptPhase]);
```

This re-runs whenever `voicePhase`/`receiptPhase` change: entering `saved`/`done`
arms a 2.5s timer; leaving them (via manual action, which changes the phase) or
unmounting clears it through the cleanup. `resetVoice`/`resetReceipt` are stable
component functions closing over `setState`, so they are safe to call here.

- [ ] **Step 2: Verify types**

Run from `apps/expenses`:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Manual check**

- Save a voice expense → the "Expense saved" banner shows, then after ~2.5s the
  panel returns to idle ("Record voice expense").
- Upload a receipt → "Receipt uploaded" banner, then auto-returns to the scan
  button after ~2.5s.
- Save, then immediately tap "Record another" before 2.5s → it starts a fresh
  recording and the pending reset does not fire over it.

- [ ] **Step 4: Commit**

```bash
git add "apps/expenses/app/(tabs)/capture.tsx"
git commit -m "feat(capture): auto-reset success state after a short delay"
```

---

## Final verification

- [ ] **From `apps/expenses`:**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Full manual smoke:** Receipt flow (scan → preview → upload → success →
  auto-reset) and both Voice flows (record → transcribe → parse → save, and typed
  → parse → save), segmented switching locked while busy, haptics on device,
  pulse while recording.

- [ ] **Confirm clean branch:**

```bash
git status
```
Expected: nothing uncommitted on `feat/capture-polish`.

## Spec coverage check

- Slim hero + Sign out moved into hero + footer removed → Task 1 ✅
- Segmented control, one active panel, default Receipt, locked while busy → Task 1 ✅
- Hero duplicate buttons removed; each panel owns its CTA → Task 1 ✅
- Voice/receipt state machines + API calls untouched → Tasks 1–4 (no handler logic changed except added haptic/reset lines) ✅
- Haptics on record start/stop, scan, save/upload success → Task 2 ✅
- Reanimated recording pulse + prominent timer → Task 3 ✅
- Success auto-reset ~2.5s, cleared on unmount/manual action → Task 4 ✅
- Verification via tsc + manual (no test harness) → every task ✅
