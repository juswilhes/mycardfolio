import { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as api from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = wird noch geladen, null = nicht angemeldet, Objekt = angemeldet
  const [user, setUser] = useState(undefined);
  const [registrationOpen, setRegistrationOpen] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const d = await api.getMe();
      setUser(d.user);
      setRegistrationOpen(d.registrationOpen !== false);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = {
    user,
    registrationOpen,
    loading: user === undefined,
    refresh,
    async login(email, password) {
      setUser(await api.login(email, password));
    },
    async register(payload) {
      setUser(await api.register(payload));
    },
    async logout() {
      await api.logout().catch(() => {});
      setUser(null);
    },
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth muss innerhalb von <AuthProvider> genutzt werden");
  return ctx;
}
