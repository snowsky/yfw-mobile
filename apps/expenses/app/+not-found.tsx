import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";

import { setAccessToken, setStoredUser } from "../src/lib/auth-storage";
import { useAuth } from "../src/providers/AuthProvider";
import { useTheme, useThemedStyles } from "../src/theme";
import { ThemeTokens } from "../src/theme/types";
import { Card, Text } from "../src/components/ui";

function decodeUserParam(userParam: string) {
  const normalized = userParam.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return JSON.parse(globalThis.atob(`${normalized}${padding}`));
}

export default function NotFoundScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ token?: string; user?: string; next?: string }>();
  const { refreshMe } = useAuth();
  const { tokens } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function recoverOAuthRedirect() {
      const token = typeof params.token === "string" ? params.token : null;
      const userParam = typeof params.user === "string" ? params.user : null;
      const next = typeof params.next === "string" ? params.next : "/capture";

      if (!token || !userParam) {
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
        setMessage(err instanceof Error ? err.message : "Failed to finish Google sign-in.");
      }
    }

    recoverOAuthRedirect();
  }, [params.next, params.token, params.user, refreshMe, router]);

  const isOAuthFallback = Boolean(params.token && params.user);

  return (
    <View style={styles.screen}>
      <Card variant="elevated" style={styles.card}>
        {isOAuthFallback ? <ActivityIndicator size="large" color={tokens.color.primary} /> : null}
        <Text variant="headingLg" center>
          {isOAuthFallback ? "Finishing sign-in" : "Page not found"}
        </Text>
        <Text variant="bodyLg" color="textMuted" center>
          {isOAuthFallback
            ? message ?? "We caught an OAuth redirect on Expo’s fallback route and are sending you back into the app."
            : `No route matched ${pathname}.`}
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
