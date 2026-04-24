import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, Redirect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

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
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  if (accessToken) {
    return <Redirect href="/capture" />;
  }

  const accentColor = serviceConfig.data?.branding.accent_color || "#10b981";
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
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.heroCard, { backgroundColor: accentColor }]}>
          <Text style={styles.kicker}>{brandTitle}</Text>
          <Text style={styles.heroTitle}>Create your account</Text>
          <Text style={styles.heroBody}>
            Your account will be created inside the organization configured for this mobile service.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Sign up</Text>
          <Text style={styles.formBody}>
            Create an account and start sending expenses into the connected YFW organization.
          </Text>

          {serviceConfig.error ? (
            <View style={styles.errorCard}>
              <Feather name="alert-circle" size={16} color="#b91c1c" />
              <Text style={styles.errorText}>
                {serviceConfig.error instanceof Error
                  ? serviceConfig.error.message
                  : "This expense service is not configured yet."}
              </Text>
            </View>
          ) : null}

          {!serviceConfig.data?.signup_enabled && !serviceConfig.isLoading ? (
            <View style={styles.infoCard}>
              <Feather name="info" size={16} color="#0f766e" />
              <Text style={styles.infoText}>
                Sign up is disabled for this deployment. Contact your YFW administrator.
              </Text>
            </View>
          ) : null}

          <TextInput
            style={styles.input}
            placeholder="First name"
            placeholderTextColor="#64748b"
            value={firstName}
            onChangeText={setFirstName}
          />
          <TextInput
            style={styles.input}
            placeholder="Last name"
            placeholderTextColor="#64748b"
            value={lastName}
            onChangeText={setLastName}
          />
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor="#64748b"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#64748b"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor="#64748b"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          {error ? (
            <View style={styles.errorCard}>
              <Feather name="alert-circle" size={16} color="#b91c1c" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.primaryButton, { backgroundColor: accentColor }]}
            onPress={handleSignup}
            disabled={isSubmitting || !serviceConfig.data?.enabled || serviceConfig.data?.signup_enabled === false}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>Create account</Text>
            )}
          </Pressable>

          <Text style={styles.footerText}>
            Already have an account?{" "}
            <Link href={"/login" as any} style={styles.footerLink}>
              Sign in
            </Link>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f4f8f7",
  },
  content: {
    padding: 16,
    gap: 14,
    paddingTop: 8,
    paddingBottom: 24,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f4f8f7",
  },
  heroCard: {
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 6,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#d1fae5",
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 20,
    color: "#ecfdf5",
    marginBottom: 2,
  },
  formCard: {
    borderRadius: 28,
    padding: 20,
    gap: 14,
    backgroundColor: "#ffffff",
  },
  formTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
  },
  formBody: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748b",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  errorCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: "#b91c1c",
    lineHeight: 20,
  },
  infoCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#ecfeff",
    borderWidth: 1,
    borderColor: "#a5f3fc",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  infoText: {
    flex: 1,
    color: "#115e59",
    lineHeight: 20,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  footerText: {
    textAlign: "center",
    fontSize: 14,
    color: "#475569",
  },
  footerLink: {
    color: "#0f766e",
    fontWeight: "700",
  },
});
