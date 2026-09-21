// Auth context.
import React, { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";

type User = {
  id: string;
  first_name: string;
  last_name: string;
  major?: string;
  year?: string;
  university?: string;
  profile_photo_url?: string | null;
  bio?: string;
  interests: string[];
  looking_for: string[];
  verified: boolean;
  onboarded: boolean;
};

type Ctx = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (u: User | null) => void;
};

const AuthCtx = createContext<Ctx>({
  user: null,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
  setUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const t = await getToken();
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user } = await api.me();
      setUser(user);
    } catch {
      await setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const signOut = async () => {
    await setToken(null);
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, loading, refresh, signOut, setUser }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
