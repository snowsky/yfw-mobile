import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { mobileUserSchema } from "../src/lib/api";
import { setAccessToken, setStoredUser } from "../src/lib/auth-storage";
import { useAuth } from "../src/providers/AuthProvider";
import { useTheme, useThemedStyles } from "../src/theme";
import { ThemeTokens } from "../src/theme/types";
import { Card, Text } from "../src/components/ui";

function decodeUserParam(userParam: string) {
  const normalized = userParam.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const decoded = JSON.parse(globalThis.atob(`${normalized}${padding}`));
  return mobileUserSchema.parse(decoded);
}

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; user?: string; next?: string }>();
  const { refreshMe } = useAuth();
  const { tokens } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function completeSignIn() {
      const token = typeof params.token === "string" ? params.token : null;
      const userParam = typeof params.user === "string" ? params.user : null;
      const next = typeof params.next === "string" ? params.next : "/capture";

      if (!token || !userParam) {
        setError("Google SSO did not return a complete session.");
        return;
      }

      try {
        const user = decodeUserParam(userParam);
        await Promise.all([
          setAccessToken(token),
          setStoredUser(user),
        ]);
        await refreshMe();
        router.replace(next as never);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to finish Google sign-in.");
      }
    }

    completeSignIn();
  }, [params.next, params.token, params.user, refreshMe, router]);

  return (
    <View style={styles.screen}>
      <Card variant="elevated" style={styles.card}>
        <ActivityIndicator size="large" color={tokens.color.primary} />
        <Text variant="headingLg" center>{error ? "Google sign-in failed" : "Finishing sign-in"}</Text>
        <Text variant="bodyLg" color="textMuted" center>
          {error ?? "We’re bringing your session back into the app."}
        </Text>
      </Card>
    </View>
  );
}

const makeStyles = (t: ThemeTokens) => ({
  screen: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    padding: t.spacing.xl,
    backgroundColor: t.color.background,
  },
  card: {
    width: "100%" as const,
    gap: t.spacing.md,
    alignItems: "center" as const,
  },
});
