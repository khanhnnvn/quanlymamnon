"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, systemApi } from "./api";
import { clearAuth, getAccessToken, readStoredUser } from "./api-client";
import type { RoleCode, User } from "./types";

// ---------------------------------------------------------------------------
// Super Admin (system scope)
// ---------------------------------------------------------------------------

interface SystemAuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  logout: () => void;
  setUser: (user: User) => void;
}

const SystemAuthContext = createContext<SystemAuthState | undefined>(undefined);

export function SystemAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = getAccessToken("system");
    if (token) {
      setUserState(readStoredUser<User>("system"));
    }
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    systemApi.logout();
    clearAuth("system");
    setUserState(null);
    router.push("/admin/login");
  }, [router]);

  return (
    <SystemAuthContext.Provider
      value={{ user, isAuthenticated: !!user, loading, logout, setUser: setUserState }}
    >
      {children}
    </SystemAuthContext.Provider>
  );
}

export function useSystemAuth(): SystemAuthState {
  const ctx = useContext(SystemAuthContext);
  if (!ctx) throw new Error("useSystemAuth phải dùng bên trong SystemAuthProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Tenant scope
// ---------------------------------------------------------------------------

export interface TenantUser extends User {
  roles: RoleCode[];
}

interface TenantAuthState {
  tenant: string;
  user: TenantUser | null;
  loading: boolean;
  error: string | null;
  hasRole: (...roles: RoleCode[]) => boolean;
  logout: () => void;
  refresh: () => Promise<void>;
}

const TenantAuthContext = createContext<TenantAuthState | undefined>(undefined);

export function TenantAuthProvider({
  tenant,
  children,
}: {
  tenant: string;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<TenantUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    const token = getAccessToken({ tenant });
    if (!token) {
      setLoading(false);
      router.replace(`/${tenant}/login`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const me = await authApi.me(tenant);
      setUser(me);
    } catch {
      setError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      clearAuth({ tenant });
      router.replace(`/${tenant}/login`);
    } finally {
      setLoading(false);
    }
  }, [tenant, router]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  const hasRole = useCallback(
    (...roles: RoleCode[]) => !!user && roles.some((r) => user.roles?.includes(r)),
    [user]
  );

  const logout = useCallback(() => {
    authApi.logout(tenant);
    setUser(null);
    router.push(`/${tenant}/login`);
  }, [tenant, router]);

  return (
    <TenantAuthContext.Provider
      value={{ tenant, user, loading, error, hasRole, logout, refresh: load }}
    >
      {children}
    </TenantAuthContext.Provider>
  );
}

export function useTenantAuth(): TenantAuthState {
  const ctx = useContext(TenantAuthContext);
  if (!ctx) throw new Error("useTenantAuth phải dùng bên trong TenantAuthProvider");
  return ctx;
}
