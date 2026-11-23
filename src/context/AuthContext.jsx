import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, onUnauthorized } from "../lib/api";
import { useToast } from "./ToastContext";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // true until we know whether the session cookie is still valid
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    api
      .get("/auth/me", undefined, { skipAuthRedirect: true })
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // Any 401 from the API (expired session, password changed elsewhere,
  // account deactivated) signs the user out locally.
  const signedIn = Boolean(user);
  useEffect(() => {
    onUnauthorized(() => {
      if (signedIn) toast.info("Your session has ended. Please sign in again.");
      setUser(null);
    });
    return () => onUnauthorized(null);
  }, [toast, signedIn]);

  const login = useCallback(async ({ email, password, rememberMe }) => {
    const res = await api.post(
      "/auth/login",
      { email, password, rememberMe },
      { skipAuthRedirect: true }
    );
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout", undefined, { skipAuthRedirect: true });
    } finally {
      setUser(null);
    }
  }, []);

  // Role helpers for showing/hiding UI. The API enforces the real rules.
  const hasRole = useCallback((...roles) => Boolean(user && roles.includes(user.role)), [user]);

  const value = useMemo(
    () => ({
      user,
      setUser,
      loading,
      login,
      logout,
      hasRole,
      isAdmin: user?.role === "admin",
      isManager: user?.role === "manager",
      canManage: user?.role === "admin" || user?.role === "manager",
    }),
    [user, loading, login, logout, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ROLE_LABELS = {
  admin: "Administrator",
  manager: "Manager",
  employee: "Employee",
};

// eslint-disable-next-line react-refresh/only-export-components
export function initials(name = "") {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join("") || "?"
  );
}
