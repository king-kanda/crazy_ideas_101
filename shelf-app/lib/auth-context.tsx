'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  type AuthState,
  type SaveAuthInput,
  clearAuth,
  getAuth,
  saveAuth,
} from '@/lib/auth';
import { api } from '@/lib/api';

interface AuthContextValue {
  auth: AuthState | null;
  workspaceId: string | null;
  merchantId: string | null;
  hasStore: boolean;
  /** True until the initial localStorage hydration has run (avoids SSR flash). */
  loading: boolean;
  setAuth: (input: SaveAuthInput) => void;
  logout: () => void;
  /** Re-sync store/workspace state from the API (e.g. after connecting a store). */
  refresh: () => Promise<AuthState | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuthState] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAuthState(getAuth());
    setLoading(false);
  }, []);

  const setAuth = useCallback((input: SaveAuthInput) => {
    saveAuth(input);
    setAuthState(getAuth());
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setAuthState(null);
  }, []);

  const refresh = useCallback(async (): Promise<AuthState | null> => {
    const current = getAuth();
    if (!current) return null;
    try {
      const me = await api.workspaceMe(current.token);
      saveAuth({
        token: current.token,
        workspaceId: me.workspaceId,
        merchantId: me.merchantId,
        apiKey: current.apiKey,
        storeId: me.storeId ?? undefined,
        storeName: me.storeName ?? undefined,
        storeUrl: current.storeUrl || undefined,
      });
    } catch {
      // Keep whatever we had if the refresh call fails (offline / transient).
    }
    const next = getAuth();
    setAuthState(next);
    return next;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        auth,
        workspaceId: auth?.workspaceId ?? null,
        merchantId: auth?.merchantId ?? null,
        hasStore: auth?.hasStore ?? false,
        loading,
        setAuth,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
