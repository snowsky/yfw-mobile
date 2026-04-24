import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";

import { authApi, type MobileUser } from "../lib/api";
import { clearSession, getAccessToken, getStoredUser, setAccessToken, setStoredUser } from "../lib/auth-storage";

type AuthContextValue = {
  isReady: boolean;
  user: MobileUser | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (payload: { email: string; password: string; first_name?: string; last_name?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type PartialMobileUser = Omit<MobileUser, "organizations"> & {
  organizations?: MobileUser["organizations"];
};

function normalizeUser(user: PartialMobileUser): MobileUser {
  return {
    ...user,
    organizations: user.organizations ?? [],
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<MobileUser | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap() {
      const [token, storedUser] = await Promise.all([getAccessToken(), getStoredUser()]);
      if (token) setAccessTokenState(token);
      if (storedUser) setUser(normalizeUser(storedUser));
      setIsReady(true);
    }

    bootstrap();
  }, []);

  async function login(email: string, password: string) {
    const response = await authApi.login(email, password);
    const normalizedUser = normalizeUser(response.user);
    await Promise.all([
      setAccessToken(response.access_token),
      setStoredUser(normalizedUser)
    ]);
    setAccessTokenState(response.access_token);
    setUser(normalizedUser);
  }

  async function signup(payload: { email: string; password: string; first_name?: string; last_name?: string }) {
    const response = await authApi.signup(payload);
    const normalizedUser = normalizeUser(response.user);
    await Promise.all([
      setAccessToken(response.access_token),
      setStoredUser(normalizedUser)
    ]);
    setAccessTokenState(response.access_token);
    setUser(normalizedUser);
  }

  async function refreshMe() {
    const current = await authApi.me();
    const normalizedUser = normalizeUser(current);
    await setStoredUser(normalizedUser);
    setUser(normalizedUser);
  }

  async function logout() {
    await clearSession();
    setAccessTokenState(null);
    setUser(null);
  }

  const value = useMemo<AuthContextValue>(() => ({
    isReady,
    user,
    accessToken,
    login,
    signup,
    logout,
    refreshMe
  }), [isReady, user, accessToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
