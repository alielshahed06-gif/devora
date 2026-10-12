'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '../lib/api';

export interface AuthUser {
  id: string;
  name: string;
  role: string;
  email?: string | null;
  phone?: string | null;
  mustChangePassword?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null | undefined;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [user, setUserState] = useState<AuthUser | null | undefined>(undefined);
  const setUser = useCallback((nextUser: AuthUser | null) => setUserState(nextUser), []);

  useEffect(() => {
    let active = true;
    void api<{ user: AuthUser | null }>('/api/v1/auth/me').then((result) => {
      if (!active) return;
      if (result.ok) setUserState(result.data.user);
      else setUserState((current) => current ?? null);
    });
    return () => { active = false; };
  }, [pathname]);

  const value = useMemo(() => ({ user, setUser }), [user, setUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth outside AuthProvider');
  return context;
}
