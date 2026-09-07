import { env } from "../config/env.js";

/**
 * ConstrTodo commerce:
 *   GET /commerce/regions, /commerce/price-list/:regionCode — публичные
 *   GET /admin/commerce/* — JWT (cookie access_token или Authorization)
 *
 * У sound_calc свой логин — cookie ConstrTodo на фронт не ставится.
 * Для admin-ручек backend логинится сам (AUTH_EMAIL / AUTH_PASSWORD) или
 * прокидывает ConstrTodo-cookie с запроса, если пользователь уже
 * залогинен в ag_co_worker на том же localhost.
 *
 * Без JWT всё равно идём на upstream: публичный справочник регионов иначе
 * обрывается 503, и браузер рисует ошибку в консоли.
 */

type CachedSession = {
  accessToken: string;
  refreshToken: string;
  expiresAtMs: number;
};

let session: CachedSession | null = null;
let loginInFlight: Promise<CachedSession | null> | null = null;

const authBase = (): string => env.authServiceUrl.replace(/\/$/, "");

const unwrapData = (body: unknown): Record<string, unknown> => {
  if (!body || typeof body !== "object") return {};
  const obj = body as Record<string, unknown>;
  if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    return obj.data as Record<string, unknown>;
  }
  return obj;
};

const pickAccessTokenFromCookie = (cookieHeader: string | undefined): string => {
  if (!cookieHeader) return "";
  const match = /(?:^|;\s*)access_token=([^;]+)/.exec(cookieHeader);
  if (!match?.[1]) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

const loginWithPassword = async (): Promise<CachedSession | null> => {
  const email = env.authEmail.trim();
  const password = env.authPassword;
  if (!email || !password) return null;

  const response = await fetch(`${authBase()}/auth/login`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "X-Client-Type": "plugin",
    },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(env.calcServiceTimeoutMs),
  });
  if (!response.ok) {
    console.error(`[commerce-auth] POST /auth/login HTTP ${response.status}`);
    return null;
  }
  const body: unknown = await response.json();
  const data = unwrapData(body);
  const accessToken = String(data.access_token ?? "").trim();
  const refreshToken = String(data.refresh_token ?? "").trim();
  if (!accessToken) {
    console.error("[commerce-auth] login: no access_token in response");
    return null;
  }
  const expiresAtRaw = data.expires_at;
  const expiresAtMs = expiresAtRaw
    ? Date.parse(String(expiresAtRaw))
    : Date.now() + 12 * 60 * 1000;
  return {
    accessToken,
    refreshToken,
    expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : Date.now() + 12 * 60 * 1000,
  };
};

const refreshSession = async (refreshToken: string): Promise<CachedSession | null> => {
  const response = await fetch(`${authBase()}/auth/refresh`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "X-Client-Type": "plugin",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
    signal: AbortSignal.timeout(env.calcServiceTimeoutMs),
  });
  if (!response.ok) return null;
  const body: unknown = await response.json();
  const data = unwrapData(body);
  const accessToken = String(data.access_token ?? "").trim();
  const nextRefresh = String(data.refresh_token ?? refreshToken).trim();
  if (!accessToken) return null;
  const expiresAtRaw = data.expires_at;
  const expiresAtMs = expiresAtRaw
    ? Date.parse(String(expiresAtRaw))
    : Date.now() + 12 * 60 * 1000;
  return {
    accessToken,
    refreshToken: nextRefresh,
    expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : Date.now() + 12 * 60 * 1000,
  };
};

const getServiceSession = async (): Promise<CachedSession | null> => {
  const skewMs = 30_000;
  if (session && session.expiresAtMs - skewMs > Date.now()) return session;
  if (loginInFlight) return loginInFlight;

  loginInFlight = (async () => {
    if (session?.refreshToken) {
      const refreshed = await refreshSession(session.refreshToken);
      if (refreshed) {
        session = refreshed;
        return session;
      }
    }
    const loggedIn = await loginWithPassword();
    session = loggedIn;
    return loggedIn;
  })().finally(() => {
    loginInFlight = null;
  });

  return loginInFlight;
};

export type CommerceFetchResult = {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
};

/**
 * GET ConstrTodo path. JWT добавляется, если есть; иначе запрос идёт без него.
 */
export const fetchCommerce = async (
  path: string,
  incomingCookie?: string
): Promise<CommerceFetchResult> => {
  const headers: Record<string, string> = {
    accept: "application/json",
    origin: authBase(),
    referer: `${authBase()}/`,
  };

  const service = await getServiceSession();
  const forwarded = pickAccessTokenFromCookie(incomingCookie);
  const token = service?.accessToken || forwarded;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const upstream = await fetch(`${authBase()}${path}`, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(env.calcServiceTimeoutMs),
  });

  const passThroughHeaders: Record<string, string> = {};
  for (const name of ["content-type", "cache-control", "etag", "last-modified"]) {
    const value = upstream.headers.get(name);
    if (value) passThroughHeaders[name] = value;
  }
  const body = upstream.body
    ? Buffer.from(await upstream.arrayBuffer())
    : Buffer.alloc(0);

  return { status: upstream.status, headers: passThroughHeaders, body };
};
