import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from "react-native";
import { Link, Redirect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { authApi } from "../src/lib/api";
import { queryKeys } from "../src/lib/queryKeys";
import { useAuth } from "../src/providers/AuthProvider";
import { useTheme, useThemedStyles } from "../src/theme";
import { ThemeTokens } from "../src/theme/types";
import { Card, Button, Text } from "../src/components/ui";

export default function SignupScreen() {
  const { accessToken, isReady, signup } = useAuth();
  const { tokens } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const serviceConfig = useQuery({
    queryKey: queryKeys.mobileConfig,
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
        <ActivityIndicator size="large" color={tokens.color.primary} />
      </View>
    );
  }

  if (accessToken) {
    return <Redirect href="/capture" />;
  }

  const brandTitle = serviceConfig.data?.branding.title || "YFW Expenses";
  const canSubmit = Boolean(
    email.trim() &&
      password &&
      confirmPassword &&
      serviceConfig.data?.enabled &&
      serviceConfig.data?.signup_enabled !== false &&
      !isSubmitting
  );

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
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.heroContainer}>
          <View style={styles.logoBadge}>
            <Feather name="user-plus" size={28} color={tokens.color.primary} />
          </View>
          <Text variant="headingXl" center>Create account</Text>
          <Text variant="bodyLg" color="textMuted" center>Join {brandTitle}.</Text>
        </View>

        <Card variant="elevated" style={styles.formCard}>
          {serviceConfig.error ? (
            <View style={styles.errorCard}>
              <Feather name="alert-circle" size={16} color={tokens.color.danger} />
              <Text variant="bodyMd" style={{ flex: 1, color: tokens.color.danger }}>
                {serviceConfig.error instanceof Error ? serviceConfig.error.message : "Service not configured."}
              </Text>
            </View>
          ) : null}

          {!serviceConfig.data?.signup_enabled && !serviceConfig.isLoading ? (
            <View style={styles.infoCard}>
              <Feather name="info" size={16} color={tokens.color.primary} />
              <Text variant="bodyMd" style={{ flex: 1, color: tokens.color.success }}>
                Sign up is disabled for this organization.
              </Text>
            </View>
          ) : null}

          <View style={styles.rowInputs}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <TextInput
                style={styles.input}
                placeholder="First name"
                placeholderTextColor={tokens.color.textSubtle}
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <TextInput
                style={styles.input}
                placeholder="Last name"
                placeholderTextColor={tokens.color.textSubtle}
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Feather name="mail" size={20} color={tokens.color.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="Email address"
              placeholderTextColor={tokens.color.textSubtle}
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <Feather name="lock" size={20} color={tokens.color.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={tokens.color.textSubtle}
              secureTextEntry
              textContentType="newPassword"
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <View style={styles.inputGroup}>
            <Feather name="check-circle" size={20} color={tokens.color.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirm password"
              placeholderTextColor={tokens.color.textSubtle}
              secureTextEntry
              textContentType="newPassword"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <Feather name="alert-circle" size={16} color={tokens.color.danger} />
              <Text variant="bodyMd" style={{ flex: 1, color: tokens.color.danger }}>{error}</Text>
            </View>
          ) : null}

          <Button label="Create account" loading={isSubmitting} disabled={!canSubmit} onPress={handleSignup} fullWidth />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text variant="bodySm" color="textSubtle" style={{ paddingHorizontal: 16 }}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.footerRow}>
            <Text variant="bodyMd" color="textMuted">Already have an account?</Text>
            <Link href={"/login" as any} asChild>
              <Pressable>
                <Text variant="bodyMd" color="primary" style={{ fontFamily: "Inter_600SemiBold" }}>Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (t: ThemeTokens) => ({
  safeArea: { flex: 1, backgroundColor: t.color.background },
  centered: { flex: 1, justifyContent: "center" as const, alignItems: "center" as const, backgroundColor: t.color.background },
  content: {
    flexGrow: 1,
    paddingHorizontal: t.spacing.xl,
    paddingTop: 40,
    paddingBottom: 40,
    justifyContent: "center" as const,
  },
  heroContainer: {
    alignItems: "center" as const,
    marginBottom: 40,
    gap: t.spacing.sm,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: t.radii.xl,
    backgroundColor: t.color.primaryMuted,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: t.spacing.sm,
  },
  formCard: {
    gap: t.spacing.md,
  },
  rowInputs: {
    flexDirection: "row" as const,
    gap: t.spacing.md,
  },
  errorCard: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    backgroundColor: t.color.danger + "1A",
    borderWidth: 1,
    borderColor: t.color.danger + "33",
    borderRadius: t.radii.md,
    padding: t.spacing.md,
    gap: t.spacing.sm,
  },
  infoCard: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    backgroundColor: t.color.primaryMuted,
    borderRadius: t.radii.md,
    padding: t.spacing.md,
    gap: t.spacing.sm,
  },
  inputGroup: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: t.color.surfaceMuted,
    borderWidth: 1,
    borderColor: t.color.border,
    borderRadius: t.radii.lg,
    paddingHorizontal: t.spacing.md,
    height: 56,
  },
  inputIcon: { marginRight: t.spacing.md },
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: t.color.text,
    height: "100%" as const,
  },
  divider: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: t.color.border,
  },
  footerRow: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    gap: 6,
  },
});
