/**
 * Единая точка общения с backend'ом (auth + offers).
 *
 * Авторизация через **httpOnly cookies** (access + refresh), которые ставит backend.
 * JS не имеет доступа к токенам — защита от XSS. Мы только:
 *   - ходим с `credentials: 'include'`, чтобы браузер отправлял cookie cross-origin;
 *   - на 401 один раз дёргаем POST /api/auth/refresh и повторяем исходный запрос;
 *   - если refresh не прошёл — эмитим DOM event 'auth:unauthorized' (AuthContext
 *     открывает LoginModal).
 */

// В dev-режиме vite (`npm run dev`) нет reverse-proxy — фронт бьёт по backend'у
// напрямую на :3006 (CORS пропускает http://localhost:5173).
// В production-сборке (`vite build`) фронт ходит по относительным `/api/*` —
// запрос идёт на тот же origin, nginx + frontend-контейнер проксируют до backend.
// VITE_API_URL оставляем как explicit override (для staging / нестандартного хоста).
const DEFAULT_BASE_URL = import.meta.env.DEV ? "http://localhost:3006" : "";
const BASE_URL = (import.meta.env.VITE_API_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");

let refreshInFlight = null;

const dispatchUnauthorized = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }
};

class ApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

const parseResponse = async (response) => {
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  try {
    return await response.text();
  } catch {
    return null;
  }
};

const buildHeaders = (init) => {
  const headers = new Headers(init.headers || {});
  if (init.body !== undefined && !(init.body instanceof FormData)) {
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
  }
  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }
  return headers;
};

const tryRefreshAccessToken = async () => {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { accept: "application/json" },
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    } finally {
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();

  return refreshInFlight;
};

const doFetch = async (path, init) => {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const body =
    init.body !== undefined && typeof init.body !== "string" && !(init.body instanceof FormData)
      ? JSON.stringify(init.body)
      : init.body;

  return fetch(url, {
    ...init,
    body,
    credentials: "include",
    headers: buildHeaders({ ...init, body }),
  });
};

/**
 * Главный метод для запросов.
 *  - path: '/api/...' или полный URL
 *  - init: { method, body (object|string), headers }
 *  - options.skipAuthRetry: не пытаться рефрешить на 401 (используется самим refresh-запросом)
 *  - options.silent401: не эмитить auth:unauthorized, просто пробросить ошибку
 */
export const request = async (path, init = {}, options = {}) => {
  let response = await doFetch(path, init);

  if (response.status === 401 && !options.skipAuthRetry) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      response = await doFetch(path, init);
    } else {
      if (!options.silent401) dispatchUnauthorized();
      const body = await parseResponse(response);
      throw new ApiError("Unauthorized", { status: 401, body });
    }
  }

  if (!response.ok) {
    const body = await parseResponse(response);
    const message =
      (body && typeof body === "object" && body.error) ||
      `HTTP ${response.status} ${response.statusText}`;
    throw new ApiError(message, { status: response.status, body });
  }

  return parseResponse(response);
};

export { ApiError };
