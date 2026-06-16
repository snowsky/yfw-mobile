import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from "react-native-reanimated";

import { expensesApi, type ExpenseDraft, type ParsedVoiceExpense } from "../../src/lib/api";
import { useAuth } from "../../src/providers/AuthProvider";
import { useTheme, useThemedStyles } from "../../src/theme";
import { ThemeTokens } from "../../src/theme/types";
import { Text, Button } from "../../src/components/ui";

type VoicePhase = "idle" | "recording" | "transcribing" | "parsed" | "saving" | "saved";
type ReceiptPhase = "idle" | "previewing" | "uploading" | "done";

function RecordingPulse() {
  const { tokens } = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    scale.value = withRepeat(withTiming(1.8, { duration: 1500 }), -1, false);
    opacity.value = withRepeat(withTiming(0, { duration: 1500 }), -1, false);
  }, [scale, opacity]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={pulseWrap} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <Animated.View style={[pulseRing, { backgroundColor: tokens.color.danger }, ringStyle]} />
    </View>
  );
}

function ModeSwitch({
  value,
  onChange,
  disabled,
}: {
  value: "receipt" | "voice";
  onChange: (next: "receipt" | "voice") => void;
  disabled?: boolean;
}) {
  const { tokens } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
            <Feather name={seg.icon} size={16} color={active ? tokens.color.primary : tokens.color.textMuted} />
            <Text variant="bodyMd" style={{ color: active ? tokens.color.text : tokens.color.textMuted, fontFamily: "Inter_600SemiBold" }}>
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function CaptureScreen() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const { tokens } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [mode, setMode] = useState<"receipt" | "voice">("receipt");

  // ── Voice state ──────────────────────────────────────────────────────────
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");
  const [transcript, setTranscript] = useState("");
  const [voiceDraft, setVoiceDraft] = useState<ParsedVoiceExpense | null>(null);
  const [voiceError, setVoiceError] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Receipt state ────────────────────────────────────────────────────────
  const [receiptPhase, setReceiptPhase] = useState<ReceiptPhase>("idle");
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [receiptMime, setReceiptMime] = useState<string>("image/jpeg");
  const [receiptExpenseId, setReceiptExpenseId] = useState<number | null>(null);
  const [receiptError, setReceiptError] = useState("");

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => undefined);
    };
  }, []);

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

  // ── Voice: start / stop recording ───────────────────────────────────────

  async function handleToggleRecording() {
    if (voicePhase === "recording") {
      await stopRecording();
    } else {
      await startRecording();
    }
  }

  async function startRecording() {
    setVoiceError("");
    setVoiceDraft(null);
    setTranscript("");
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setVoiceError("Microphone permission is required.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setVoicePhase("recording");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch (e) {
      setVoiceError(e instanceof Error ? e.message : "Could not start recording.");
    }
  }

  async function stopRecording() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const recording = recordingRef.current;
    if (!recording) return;
    setVoicePhase("transcribing");
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error("No recording URI available.");

      const fileName = `expense_${Date.now()}.m4a`;
      const result = await expensesApi.transcribeAudio(uri, fileName, "audio/m4a");
      setTranscript(result.transcript);
      await parseDraft(result.transcript);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transcription failed.";
      setVoiceError(msg);
      setVoicePhase("idle");
    }
  }

  // ── Voice: parse transcript ──────────────────────────────────────────────

  async function parseDraft(text?: string) {
    const source = (text ?? transcript).trim();
    if (!source) {
      setVoiceError("Please enter or record an expense description.");
      return;
    }
    setVoiceError("");
    if (voicePhase !== "transcribing") setVoicePhase("transcribing");
    try {
      const parsed = await expensesApi.parseVoice(source);
      setVoiceDraft(parsed);
      setTranscript(parsed.transcript);
      setVoicePhase("parsed");
    } catch (e) {
      setVoiceError(e instanceof Error ? e.message : "Parsing failed.");
      setVoicePhase("idle");
    }
  }

  // ── Voice: save expense ──────────────────────────────────────────────────

  async function saveVoiceExpense() {
    if (!voiceDraft) return;
    setVoicePhase("saving");
    try {
      const draft: ExpenseDraft = {
        amount: voiceDraft.amount ?? null,
        currency: voiceDraft.currency,
        expense_date: voiceDraft.expense_date,
        category: voiceDraft.category,
        vendor: voiceDraft.vendor,
        notes: voiceDraft.notes ?? (voiceDraft.transcript ? `Voice: "${voiceDraft.transcript}"` : null),
      };
      await expensesApi.createExpense(draft);
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setVoicePhase("saved");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setVoiceError(e instanceof Error ? e.message : "Failed to save expense.");
      setVoicePhase("parsed");
    }
  }

  function resetVoice() {
    setVoicePhase("idle");
    setTranscript("");
    setVoiceDraft(null);
    setVoiceError("");
    setRecordingSeconds(0);
  }

  // ── Receipt: capture photo ───────────────────────────────────────────────

  async function handlePickReceipt() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setReceiptError("");
    try {
      const ImagePicker = await import("expo-image-picker");
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setReceiptError("Camera permission is required.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (result.canceled) return;

      const asset = result.assets[0];
      const ext = (asset.fileName ?? asset.uri).split(".").pop()?.toLowerCase() ?? "jpg";
      const mime = ext === "png" ? "image/png" : "image/jpeg";
      setReceiptUri(asset.uri);
      setReceiptFileName(asset.fileName ?? `receipt_${Date.now()}.${ext}`);
      setReceiptMime(mime);
      setReceiptExpenseId(null);
      setReceiptPhase("previewing");
    } catch (e) {
      setReceiptError(e instanceof Error ? e.message : "Camera error.");
    }
  }

  async function handlePickGallery() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setReceiptError("");
    try {
      const ImagePicker = await import("expo-image-picker");
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setReceiptError("Gallery permission is required.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (result.canceled) return;

      const asset = result.assets[0];
      const ext = (asset.fileName ?? asset.uri).split(".").pop()?.toLowerCase() ?? "jpg";
      const mime = ext === "png" ? "image/png" : "image/jpeg";
      setReceiptUri(asset.uri);
      setReceiptFileName(asset.fileName ?? `receipt_${Date.now()}.${ext}`);
      setReceiptMime(mime);
      setReceiptExpenseId(null);
      setReceiptPhase("previewing");
    } catch (e) {
      setReceiptError(e instanceof Error ? e.message : "Gallery error.");
    }
  }

  // ── Receipt: create expense + upload ────────────────────────────────────

  async function handleUploadReceipt() {
    if (!receiptUri || !receiptFileName) return;
    setReceiptPhase("uploading");
    setReceiptError("");
    try {
      let expenseId = receiptExpenseId;
      if (expenseId == null) {
        const today = new Date().toISOString().split("T")[0];
        const expense = await expensesApi.createExpense({
          amount: null,
          currency: "USD",
          expense_date: today,
          category: "General",
          notes: "Uploaded via mobile receipt scan — pending OCR review.",
        });
        expenseId = expense.id;
        setReceiptExpenseId(expenseId);
      }

      await expensesApi.uploadReceipt(expenseId, receiptUri, receiptFileName, receiptMime);
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setReceiptPhase("done");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setReceiptError(e instanceof Error ? e.message : "Upload failed.");
      setReceiptPhase("previewing");
    }
  }

  function resetReceipt() {
    setReceiptPhase("idle");
    setReceiptUri(null);
    setReceiptFileName(null);
    setReceiptExpenseId(null);
    setReceiptError("");
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const confidenceLabel = (c: number) => {
    if (c >= 0.8) return "High confidence";
    if (c >= 0.5) return "Medium confidence";
    return "Low confidence";
  };

  const confidenceColor = (c: number) => {
    if (c >= 0.8) return tokens.color.success;
    if (c >= 0.5) return tokens.color.warning;
    return tokens.color.danger;
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const isVoiceBusy = voicePhase === "transcribing" || voicePhase === "saving";
  const isReceiptBusy = receiptPhase === "uploading";
  const switchLocked = voicePhase === "recording" || isVoiceBusy || isReceiptBusy;

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── Slim hero ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Text variant="headingXl" style={{ flex: 1 }} numberOfLines={2}>Capture in seconds</Text>
            <Pressable onPress={logout} hitSlop={10} accessibilityRole="button" accessibilityLabel="Sign out">
              <Text variant="bodyMd" color="primary" style={{ fontFamily: "Inter_600SemiBold" }}>Sign out</Text>
            </Pressable>
          </View>
          <Text variant="bodyMd" color="textMuted" numberOfLines={1}>
            {user?.email ?? "Speak an expense or snap a receipt."}
          </Text>
        </View>

        {/* ── Mode switch ── */}
        <ModeSwitch value={mode} onChange={setMode} disabled={switchLocked} />

        {/* ── Receipt panel ── */}
        {mode === "receipt" && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Feather name="camera" size={16} color={tokens.color.primary} />
                <Text variant="headingMd">Receipt scan</Text>
              </View>
              <Text variant="bodyMd" color="textMuted">
                Snap a photo — a draft expense is created and sent for OCR review.
              </Text>
            </View>

            {receiptUri && receiptPhase !== "idle" && (
              <Image source={{ uri: receiptUri }} style={styles.receiptPreview} resizeMode="cover" />
            )}

            {receiptError ? <Text variant="bodySm" color="danger">{receiptError}</Text> : null}

            {(receiptPhase === "idle" || receiptPhase === "done") && (
              <View style={styles.inlineRow}>
                <Button
                  label="Camera scan"
                  onPress={handlePickReceipt}
                  leftIcon={<Feather name="camera" size={16} color={tokens.color.onPrimary} />}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Choose gallery"
                  variant="outline"
                  onPress={handlePickGallery}
                  leftIcon={<Feather name="image" size={16} color={tokens.color.primary} />}
                  style={{ flex: 1 }}
                />
              </View>
            )}

            {receiptPhase === "previewing" && (
              <View style={styles.inlineRow}>
                <Button
                  label="Upload & save"
                  onPress={handleUploadReceipt}
                  leftIcon={<Feather name="upload" size={15} color={tokens.color.onPrimary} />}
                  style={{ flex: 1 }}
                />
                <Button label="Discard" variant="outline" onPress={resetReceipt} style={{ flex: 1 }} />
              </View>
            )}

            {receiptPhase === "uploading" && (
              <View style={styles.uploadingRow}>
                <ActivityIndicator color={tokens.color.primary} />
                <Text variant="bodyMd" color="textMuted">Uploading receipt…</Text>
              </View>
            )}

            {receiptPhase === "done" && (
              <View style={styles.successBanner}>
                <Feather name="check-circle" size={18} color={tokens.color.success} />
                <Text variant="bodyMd" style={{ color: tokens.color.success, flex: 1, fontFamily: "Inter_600SemiBold" }}>
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
                <Feather name="mic" size={16} color={tokens.color.primary} />
                <Text variant="headingMd">Voice expense</Text>
              </View>
              <Text variant="bodyMd" color="textMuted">
                Tap record, or type a description and tap Parse.
              </Text>
            </View>

            {/* Circular mic recorder container */}
            <View style={styles.micContainer}>
              {voicePhase === "recording" && <RecordingPulse />}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={voicePhase === "recording" ? "Stop recording" : "Record voice expense"}
                style={[
                  styles.micCircle,
                  voicePhase === "recording" && styles.micCircleActive,
                  isVoiceBusy && styles.buttonDisabled,
                ]}
                onPress={voicePhase === "saved" ? resetVoice : handleToggleRecording}
                disabled={isVoiceBusy}
              >
                {isVoiceBusy ? (
                  <ActivityIndicator color={tokens.color.onPrimary} size="large" />
                ) : (
                  <Feather
                    name={voicePhase === "recording" ? "square" : voicePhase === "saved" ? "check-circle" : "mic"}
                    size={28}
                    color={tokens.color.onPrimary}
                  />
                )}
              </Pressable>

              <Text variant="bodyLg" color="textMuted" style={{ fontFamily: "Inter_600SemiBold", marginTop: 4 }}>
                {voicePhase === "recording"
                  ? `Listening… ${fmtTime(recordingSeconds)}`
                  : voicePhase === "transcribing"
                  ? "Transcribing your audio…"
                  : voicePhase === "saving"
                  ? "Saving expense…"
                  : voicePhase === "saved"
                  ? "Saved successfully!"
                  : "Tap to record and speak"}
              </Text>
            </View>

            <TextInput
              multiline
              numberOfLines={3}
              value={transcript}
              onChangeText={setTranscript}
              placeholder='e.g. "Spent $18 on lunch at Freshii today"'
              placeholderTextColor={tokens.color.textSubtle}
              style={styles.textarea}
              editable={voicePhase !== "recording" && voicePhase !== "transcribing"}
            />

            {voicePhase !== "saved" && voicePhase !== "recording" && (
              <View style={styles.inlineRow}>
                <Button
                  label={voicePhase === "transcribing" ? "Parsing…" : "Parse draft"}
                  variant="outline"
                  onPress={() => parseDraft()}
                  disabled={isVoiceBusy || !transcript.trim()}
                  style={{ flex: 1 }}
                />
              </View>
            )}

            {voiceError ? <Text variant="bodySm" color="danger">{voiceError}</Text> : null}

            {voiceDraft && voicePhase !== "idle" && voicePhase !== "saved" && (
              <View style={styles.draftCard}>
                <View style={styles.draftRow}>
                  <Text variant="headingLg" style={{ flex: 1, color: tokens.color.primary }}>
                    {voiceDraft.amount != null
                      ? `${voiceDraft.currency} ${voiceDraft.amount.toFixed(2)}`
                      : "Amount unknown"}
                  </Text>
                  <Text variant="bodySm" style={{ color: confidenceColor(voiceDraft.confidence), marginTop: 4, fontFamily: "Inter_600SemiBold" }}>
                    {confidenceLabel(voiceDraft.confidence)}
                  </Text>
                </View>
                <Text variant="bodyMd" color="textMuted">
                  {[voiceDraft.category, voiceDraft.vendor, voiceDraft.expense_date]
                    .filter(Boolean)
                    .join("  ·  ")}
                </Text>
                <Text variant="bodySm" color="textSubtle">
                  {voiceDraft.parser_used.toUpperCase()} · {Math.round(voiceDraft.confidence * 100)}%
                </Text>

                <Button
                  label="Save expense"
                  onPress={saveVoiceExpense}
                  loading={voicePhase === "saving"}
                  style={{ marginTop: 4 }}
                />
              </View>
            )}

            {voicePhase === "saved" && (
              <View style={styles.successBanner}>
                <Feather name="check-circle" size={18} color={tokens.color.success} />
                <Text variant="bodyMd" style={{ color: tokens.color.success, flex: 1, fontFamily: "Inter_600SemiBold" }}>Expense saved — visible in Timeline</Text>
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// Layout-only constants for the pulse ring (color is applied at runtime from tokens).
const pulseWrap = {
  position: "absolute" as const,
  width: 80,
  height: 80,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const pulseRing = {
  position: "absolute" as const,
  width: 80,
  height: 80,
  borderRadius: 40,
};

const makeStyles = (t: ThemeTokens) => ({
  safeArea: { flex: 1, backgroundColor: t.color.background },
  screen: { flex: 1, backgroundColor: t.color.background },
  content: { padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: 120 },

  heroCard: {
    borderRadius: t.radii.xl,
    padding: t.spacing.lg,
    gap: t.spacing.xs,
    backgroundColor: t.color.primaryMuted,
    borderWidth: 1,
    borderColor: t.color.primary + "26",
    overflow: "hidden" as const,
  },
  heroTopRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, gap: t.spacing.md },

  segment: {
    flexDirection: "row" as const,
    backgroundColor: t.color.surfaceMuted,
    borderRadius: t.radii.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  segmentItem: {
    flex: 1,
    minHeight: 46,
    borderRadius: t.radii.md,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: t.spacing.sm,
  },
  segmentItemActive: {
    backgroundColor: t.color.surface,
    ...t.shadow.soft,
  },

  micContainer: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: t.spacing.xl,
    gap: t.spacing.lg,
  },
  micCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: t.color.primary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    ...t.shadow.medium,
  },
  micCircleActive: {
    backgroundColor: t.color.danger,
  },
  buttonDisabled: { opacity: 0.55 },

  sectionCard: {
    borderRadius: t.radii.xl,
    padding: t.spacing.lg,
    gap: t.spacing.md,
    backgroundColor: t.color.surface,
    ...t.shadow.soft,
  },
  sectionHeader: { gap: 6 },
  sectionTitleRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: t.spacing.sm },

  textarea: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: t.color.border,
    borderRadius: t.radii.lg,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.md,
    backgroundColor: t.color.surfaceMuted,
    color: t.color.text,
    textAlignVertical: "top" as const,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },

  inlineRow: { flexDirection: "row" as const, gap: t.spacing.sm, flexWrap: "wrap" as const },

  draftCard: {
    borderRadius: t.radii.lg,
    padding: t.spacing.lg,
    gap: t.spacing.sm,
    backgroundColor: t.color.primaryMuted,
    borderWidth: 1,
    borderColor: t.color.primary + "33",
  },
  draftRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "flex-start" as const, gap: t.spacing.md },

  receiptPreview: {
    width: "100%" as const,
    height: 200,
    borderRadius: t.radii.lg,
    backgroundColor: t.color.surfaceMuted,
  },

  successBanner: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: t.spacing.sm,
    backgroundColor: t.color.primaryMuted,
    borderRadius: t.radii.lg,
    padding: t.spacing.md,
  },
  uploadingRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: t.spacing.sm },
});
