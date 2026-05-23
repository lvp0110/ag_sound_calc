import { env } from "../config/env.js";
import { fetchUpstreamCached } from "./upstreamCache.js";

/**
 * Серверный аналог frontend getAllIsolationConstr + buildTitleByCodeMap.
 * Используется только для рендера PDF КП (на бэке нужно имя конструкции по
 * её Code, чтобы строки-заголовки секций таблицы материалов содержали
 * человекочитаемые названия — как на странице КП).
 */

const CATALOG_PATH = "/api/v1/AllIsolationConstr";
const CATALOG_CACHE_KEY = "AllIsolationConstr";

export type CatalogEntry = { name: string; description: string };

const parseList = (payload: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;
  if (payload && typeof payload === "object") {
    const data = (payload as Record<string, unknown>).data;
    if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  }
  return [];
};

export const buildTitleByCode = async (): Promise<Map<string, CatalogEntry>> => {
  const targetBase = env.calcServiceUrl.replace(/\/$/, "");
  const cached = await fetchUpstreamCached(CATALOG_CACHE_KEY, async () => {
    const upstream = await fetch(`${targetBase}${CATALOG_PATH}`, {
      method: "GET",
      headers: { accept: "application/json", origin: targetBase, referer: `${targetBase}/` },
      signal: AbortSignal.timeout(env.calcServiceTimeoutMs),
    });
    const headers: Record<string, string> = {};
    for (const name of ["content-type", "cache-control", "etag", "last-modified"]) {
      const v = upstream.headers.get(name);
      if (v) headers[name] = v;
    }
    const body = upstream.body ? Buffer.from(await upstream.arrayBuffer()) : Buffer.alloc(0);
    return { status: upstream.status, headers, body };
  });

  const result = new Map<string, CatalogEntry>();
  if (cached.status >= 400 || cached.body.length === 0) return result;
  let payload: unknown = null;
  try {
    payload = JSON.parse(cached.body.toString("utf-8"));
  } catch {
    return result;
  }

  for (const row of parseList(payload)) {
    const code = row.Code;
    if (typeof code !== "string" || !code) continue;
    result.set(code, {
      name: typeof row.Name === "string" ? row.Name : "",
      description: typeof row.Description === "string" ? row.Description : "",
    });
  }
  return result;
};
