import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import { api, tokenStore, userStore } from '@/lib/api';
import { JwtUser, LoginResponse } from '@/lib/types';

interface AuthContextValue {
  user: JwtUser | null;
  tokensValid: boolean;
  hasPermission: (permission: string) => boolean;
  isAdmin: () => boolean;
  setAuth: (data: LoginResponse) => void;
  setUser: (user: JwtUser) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface CachedUser {
  id: string;
  email: string;
  role: string;
  name: string;
  status: string;
  emailVerified: boolean;
  permissions?: string[];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<JwtUser | null>(() => {
    const cached = userStore.get<CachedUser>();
    if (!cached) return null;
    return { ...cached, permissions: cached.permissions ?? [] };
  });

  const setAuth = useCallback((data: LoginResponse) => {
    tokenStore.set(data.tokens);
    const u: CachedUser = data.user;
    userStore.set(u);
    setUserState({ ...u, permissions: data.user.permissions ?? [] });
  }, []);

  const setUser = useCallback((u: JwtUser) => {
    const cached: CachedUser = u;
    userStore.set(cached);
    setUserState(u);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    userStore.clear();
    setUserState(null);
    window.location.assign('/login');
  }, []);

  const refreshProfile = useCallback(async () => {
    const res = await api.get<JwtUser>('/me');
    setUser({ ...res.data, permissions: res.data.permissions ?? [] });
  }, [setUser]);

  const hasPermission = useCallback(
    (permission: string) => {
      if (!user) return false;
      if (user.permissions.includes('*')) return true;
      return user.permissions.includes(permission);
    },
    [user],
  );

  const isAdmin = useCallback(() => {
    return hasPermission('*') || user?.role === 'admin' || user?.role === 'super_admin';
  }, [hasPermission, user]);

  const value = useMemo(
    () => ({
      user,
      tokensValid: Boolean(user && tokenStore.get()),
      hasPermission,
      isAdmin,
      setAuth,
      setUser,
      logout,
      refreshProfile,
    }),
    [user, hasPermission, isAdmin, setAuth, setUser, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}