import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as authApi from "../services/authApi.js";
import { useOfferEditSessionStore } from "../stores/offerEditSessionStore.js";

const AuthContext = createContext(null);

/**
 * Состояние:
 *   status: 'loading' — первичный bootstrap (пробуем refresh + me)
 *           'authed'  — пользователь залогинен, user заполнен
 *           'anon'    — пользователь не залогинен
 *
 * loginModal.isOpen — открывает ли LoginModal (рендерится глобально в App.jsx).
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const [loginModal, setLoginModal] = useState({ isOpen: false });

  // bootstrap на mount: refresh → если ок, то ставим токен + user из ответа.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authApi.refresh();
        if (cancelled) return;
        if (data?.user) {
          setUser(data.user);
          setStatus("authed");
          return;
        }
      } catch {
        // no refresh cookie — нормальная ситуация для анонима
      }
      if (!cancelled) {
        setUser(null);
        setStatus("anon");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // глобальный слушатель: apiClient эмитит при 401 + провалившемся refresh
  useEffect(() => {
    const handler = () => {
      useOfferEditSessionStore.getState().clearSession();
      setUser(null);
      setStatus("anon");
      setLoginModal({ isOpen: true });
    };
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await authApi.login(credentials);
    setUser(data.user);
    setStatus("authed");
    setLoginModal({ isOpen: false });
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await authApi.register(payload);
    setUser(data.user);
    setStatus("authed");
    setLoginModal({ isOpen: false });
    return data;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    useOfferEditSessionStore.getState().clearSession();
    setUser(null);
    setStatus("anon");
  }, []);

  const openLoginModal = useCallback(() => setLoginModal({ isOpen: true }), []);
  const closeLoginModal = useCallback(() => setLoginModal({ isOpen: false }), []);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthed: status === "authed",
      loginModal,
      login,
      register,
      logout,
      openLoginModal,
      closeLoginModal,
    }),
    [user, status, loginModal, login, register, logout, openLoginModal, closeLoginModal]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
