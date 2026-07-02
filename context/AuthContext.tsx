"use client";

// Auth state shared across the app (header bar, save buttons, saved list).
// Sessions are carried by an httpOnly cookie, so every request sends
// `credentials: "include"` per the API contract in lib/constants.ts.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AUTH_LOGIN_ENDPOINT,
  AUTH_LOGOUT_ENDPOINT,
  AUTH_ME_ENDPOINT,
  AUTH_SIGNUP_ENDPOINT,
  type AuthResponse,
  type AuthUser,
  type MeResponse,
} from "@/lib/constants";

export type AuthMode = "login" | "signup";
export type AuthResult = { ok: boolean; error?: string };

type AuthContextValue = {
  user: AuthUser | null;
  /** True once the initial GET /api/auth/me has resolved. */
  ready: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  signup: (email: string, password: string, passwordConfirm: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  // Auth dialog is a single global instance; any component can open it
  // (e.g. a save attempt while logged out — FR-0.3).
  dialogOpen: boolean;
  dialogMode: AuthMode;
  openAuthDialog: (mode?: AuthMode) => void;
  closeAuthDialog: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const GENERIC_ERROR =
  "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
const NETWORK_ERROR =
  "요청을 보내지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<AuthMode>("login");

  // Restore session on first load.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(AUTH_ME_ENDPOINT, { credentials: "include" });
        let data: MeResponse | null = null;
        try {
          data = (await res.json()) as MeResponse;
        } catch {
          data = null;
        }
        if (alive && res.ok && data && data.success === true) {
          setUser(data.user);
        }
      } catch {
        // Offline / server down — treat as logged out.
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const authenticate = useCallback(
    async (
      endpoint: string,
      email: string,
      password: string,
      passwordConfirm?: string,
    ): Promise<AuthResult> => {
      try {
        const body: Record<string, string> = { email, password };
        if (passwordConfirm !== undefined) {
          body.passwordConfirm = passwordConfirm;
        }
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        let data: AuthResponse | null = null;
        try {
          data = (await res.json()) as AuthResponse;
        } catch {
          data = null;
        }
        if (!res.ok || !data || data.success !== true) {
          return {
            ok: false,
            error:
              (data && data.success === false && data.error) || GENERIC_ERROR,
          };
        }
        setUser(data.user);
        return { ok: true };
      } catch {
        return { ok: false, error: NETWORK_ERROR };
      }
    },
    [],
  );

  const login = useCallback(
    (email: string, password: string) =>
      authenticate(AUTH_LOGIN_ENDPOINT, email, password),
    [authenticate],
  );

  const signup = useCallback(
    (email: string, password: string, passwordConfirm: string) =>
      authenticate(AUTH_SIGNUP_ENDPOINT, email, password, passwordConfirm),
    [authenticate],
  );

  const logout = useCallback(async () => {
    try {
      await fetch(AUTH_LOGOUT_ENDPOINT, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Even if the network call fails, drop the client-side session so the
      // UI reflects the user's intent.
    }
    setUser(null);
  }, []);

  const openAuthDialog = useCallback((mode: AuthMode = "login") => {
    setDialogMode(mode);
    setDialogOpen(true);
  }, []);

  const closeAuthDialog = useCallback(() => setDialogOpen(false), []);

  // Close the dialog automatically once a user is present.
  useEffect(() => {
    if (user) setDialogOpen(false);
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      login,
      signup,
      logout,
      dialogOpen,
      dialogMode,
      openAuthDialog,
      closeAuthDialog,
    }),
    [
      user,
      ready,
      login,
      signup,
      logout,
      dialogOpen,
      dialogMode,
      openAuthDialog,
      closeAuthDialog,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
