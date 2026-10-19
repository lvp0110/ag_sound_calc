import { env } from "../config/env.js";

/**
 * Публичные ConstrTodo commerce endpoints. Это server-to-server запросы:
 * браузерные Origin/Referer и JWT им не нужны.
 */

const authBase = (): string => env.authServiceUrl.replace(/\/$/, "");

export type CommerceFetchResult = {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
};

/** GET публичного ConstrTodo commerce path без авторизации. */
export const fetchCommerce = async (path: string): Promise<CommerceFetchResult> => {
  const headers: Record<string, string> = {
    accept: "application/json",
  };

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
