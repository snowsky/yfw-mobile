import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from "react-native-reanimated";

import { expensesApi, type ExpenseDraft, type ParsedVoiceExpense } from "../../src/lib/api";
import { useAuth } from "../../src/providers/AuthProvider";

type VoicePhase = "idle" | "recording" | "transcribing" | "parsed" | "saving" | "saved";
type ReceiptPhase = "idle" | "previewing" | "uploading" | "done";

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

export default function CaptureScreen() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"receipt" | "voice">("receipt");

  // ── Voice state ──────────────────────────────────────────────────────────
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");
  const [transcript, setTranscript] = useState("");
  const [voiceDraft, setVoiceDraft] = useState<ParsedVoiceExpense | null>(null);
  const [voiceError, setVoiceError] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    if (c >= 0.8) return "#059669";
    if (c >= 0.5) return "#d97706";
    return "#dc2626";
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

            {voicePhase === "recording" && (
              <View style={styles.recordingRow}>
                <RecordingPulse />
                <Text style={styles.recordingTimer}>{fmtTime(recordingSeconds)}</Text>
                <Text style={styles.recordingHint}>Listening…</Text>
              </View>
            )}

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
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  screen: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 16, gap: 16, paddingBottom: 40 },

  // Hero card
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
  recordingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  recordingTimer: { fontFamily: "Outfit_700Bold", fontSize: 18, color: "#ef4444" },
  recordingHint: { fontFamily: "Outfit_500Medium", fontSize: 13, color: "#94a3b8" },
  pulseWrap: { width: 16, height: 16, alignItems: "center", justifyContent: "center" },
  pulseRing: { position: "absolute", width: 16, height: 16, borderRadius: 8, backgroundColor: "#ef4444" },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444" },
  buttonDisabled: { opacity: 0.55 },

  // Section cards
  sectionCard: { 
    borderRadius: 18, 
    padding: 18, 
    gap: 14, 
    backgroundColor: "#ffffff",
    shadowColor: "#cbd5e1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: { gap: 6 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontFamily: "Outfit_700Bold", fontSize: 20, color: "#0F172A" },
  sectionDescription: { fontFamily: "Outfit_400Regular", fontSize: 14, lineHeight: 20, color: "#64748B" },

  // Text input
  textarea: {
    minHeight: 88, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#f8fafc",
    color: "#0F172A", textAlignVertical: "top", fontFamily: "Outfit_400Regular", fontSize: 15,
  },

  // Inline buttons
  inlineRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  inlineBtn: {
    minHeight: 46, paddingHorizontal: 18, borderRadius: 14,
    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
  },
  outlineBtn: { borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#ffffff" },
  outlineBtnText: { color: "#0F172A", fontFamily: "Outfit_700Bold", fontSize: 15 },
  primaryBtn: { backgroundColor: "#059669" },
  primaryBtnText: { color: "#ffffff", fontFamily: "Outfit_700Bold", fontSize: 15 },

  // Draft preview
  draftCard: {
    borderRadius: 16, padding: 16, gap: 8, backgroundColor: "rgba(16, 185, 129, 0.05)",
    borderWidth: 1, borderColor: "rgba(16, 185, 129, 0.2)",
  },
  draftRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  draftAmount: { flex: 1, fontFamily: "Outfit_700Bold", fontSize: 22, color: "#065f46" },
  draftConfidence: { fontFamily: "Outfit_600SemiBold", fontSize: 12, marginTop: 4 },
  draftMeta: { fontFamily: "Outfit_500Medium", fontSize: 14, color: "#475569", lineHeight: 20 },
  draftParser: { fontFamily: "Outfit_400Regular", fontSize: 12, color: "#94a3b8" },

  // Receipt preview
  receiptPreview: {
    width: "100%", height: 200, borderRadius: 16, backgroundColor: "#f1f5f9",
  },

  // Status rows
  successBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.1)", borderRadius: 16, padding: 12,
  },
  successText: { fontFamily: "Outfit_600SemiBold", fontSize: 14, color: "#047857", flex: 1 },
  uploadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  uploadingText: { fontFamily: "Outfit_500Medium", fontSize: 14, color: "#475569" },
  errorText: { fontFamily: "Outfit_400Regular", fontSize: 13, color: "#ef4444", lineHeight: 18 },
});
