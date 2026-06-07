import { request } from "./apiClient.js";

/**
 * Все auth-эндпоинты возвращают только { user }. Токены хранит браузер в
 * httpOnly cookies (accessToken на /api, refreshToken на /api/auth).
 */

/** POST /api/auth/login — { email, password } → { user } */
export const login = ({ email, password }) =>
  request(
    "/api/auth/login",
    {
      method: "POST",
      body: { email, password },
    },
    { skipAuthRetry: true }
  );

/** POST /api/auth/refresh — обновляет access+refresh cookies, возвращает { user } */
export const refresh = () =>
  request("/api/auth/refresh", { method: "POST" }, { skipAuthRetry: true, silent401: true });

/** POST /api/auth/logout — очищает обе cookies. */
export const logout = async () => {
  try {
    await request("/api/auth/logout", { method: "POST" }, { skipAuthRetry: true, silent401: true });
  } catch {
    // ignore
  }
};

/** GET /api/users/me — текущий пользователь. */
export const me = () => request("/api/users/me", { method: "GET" }, { silent401: true });

/** PUT /api/users/me — обновить профиль. */
export const updateMe = (patch) => request("/api/users/me", { method: "PUT", body: patch });
