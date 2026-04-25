import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Platform } from "react-native";
import { Link, Redirect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

import { authApi } from "../src/lib/api";
import { useAuth } from "../src/providers/AuthProvider";

export default function SignupScreen() {
  const { accessToken, isReady, signup } = useAuth();
  const serviceConfig = useQuery({
    queryKey: ["expense-mobile-config"],
    queryFn: authApi.getConfig,
  });
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isReady) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (accessToken) {
    return <Redirect href="/capture" />;
  }

  const brandTitle = serviceConfig.data?.branding.title || "YFW Expenses";

  async function handleSignup() {
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    try {
      await signup({
        email: email.trim(),
        password,
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign up.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <LinearGradient colors={["#F8FAFC", "#F1F5F9", "#E2E8F0"]} style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          
          <View style={styles.heroContainer}>
            <LinearGradient
              colors={["rgba(16, 185, 129, 0.2)", "rgba(16, 185, 129, 0)"]}
              style={styles.heroGlow}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
            <View style={styles.logoBadge}>
              <Feather name="user-plus" size={28} color="#059669" />
            </View>
            <Text style={styles.heroTitle}>Create Account</Text>
            <Text style={styles.heroBody}>Join {brandTitle} organization.</Text>
          </View>

          <BlurView intensity={Platform.OS === 'ios' ? 40 : 80} tint="light" style={styles.formCard}>
            
            {serviceConfig.error ? (
              <View style={styles.errorCard}>
                <Feather name="alert-circle" size={16} color="#ef4444" />
                <Text style={styles.errorText}>
                  {serviceConfig.error instanceof Error
                    ? serviceConfig.error.message
                    : "Service not configured."}
                </Text>
              </View>
            ) : null}

            {!serviceConfig.data?.signup_enabled && !serviceConfig.isLoading ? (
              <View style={styles.infoCard}>
                <Feather name="info" size={16} color="#059669" />
                <Text style={styles.infoText}>
                  Sign up is disabled for this organization.
                </Text>
              </View>
            ) : null}

            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, styles.flexHalf]}>
                <TextInput
                  style={styles.input}
                  placeholder="First name"
                  placeholderTextColor="#94a3b8"
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>
              <View style={[styles.inputGroup, styles.flexHalf]}>
                <TextInput
                  style={styles.input}
                  placeholder="Last name"
                  placeholderTextColor="#94a3b8"
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Feather name="mail" size={20} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="Email address"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputGroup}>
              <Feather name="lock" size={20} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <View style={styles.inputGroup}>
              <Feather name="check-circle" size={20} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm password"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>

            {error ? (
              <View style={styles.errorCard}>
                <Feather name="alert-circle" size={16} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                (!serviceConfig.data?.enabled || serviceConfig.data?.signup_enabled === false || isSubmitting) && styles.primaryButtonDisabled
              ]}
              onPress={handleSignup}
              disabled={isSubmitting || !serviceConfig.data?.enabled || serviceConfig.data?.signup_enabled === false}
            >
              <LinearGradient
                colors={["#10b981", "#059669"]}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                borderRadius={16}
              />
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Create Account</Text>
              )}
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <Link href={"/login" as any} asChild>
                <Pressable>
                  <Text style={styles.footerLink}>Sign in</Text>
                </Pressable>
              </Link>
            </View>

          </BlurView>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    justifyContent: "center",
  },
  heroContainer: {
    alignItems: "center",
    marginBottom: 40,
    position: "relative",
  },
  heroGlow: {
    position: "absolute",
    top: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  heroTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 32,
    color: "#0F172A",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  heroBody: {
    fontFamily: "Outfit_400Regular",
    fontSize: 16,
    color: "#475569",
  },
  formCard: {
    borderRadius: 32,
    padding: 28,
    gap: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  rowInputs: {
    flexDirection: "row",
    gap: 12,
  },
  flexHalf: {
    flex: 1,
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontFamily: "Outfit_400Regular",
    fontSize: 16,
    color: "#0F172A",
    height: "100%",
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    color: "#b91c1c",
    lineHeight: 20,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    color: "#047857",
    lineHeight: 20,
  },
  primaryButton: {
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonPressed: { transform: [{ scale: 0.98 }] },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 16,
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  dividerText: {
    fontFamily: "Outfit_500Medium",
    fontSize: 12,
    color: "#94a3b8",
    paddingHorizontal: 16,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  footerText: {
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    color: "#64748b",
  },
  footerLink: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 14,
    color: "#059669",
  },
});
