import { Router, type Request, type Response as ExpressResponse } from "express";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { env } from "../config/env.js";

/**
 * Прокси на внешний сервис расчёта конструкций.
 *
 * Эндпоинты повторяют контракт внешнего сервиса, поэтому фронт может просто
 * сменить origin (с https://dev3.constrtodo.ru:3005 на наш backend) без изменения
 * путей.
 *
 * Прокси публичный (без requireAuth): калькулятор работает до логина.
 * Лимит/аутентификация — задача внешнего сервиса, backend только прокидывает.
 */
const router = Router();

const getTargetBase = (): string => env.calcServiceUrl.replace(/\/$/, "");

const buildTargetUrl = (pathAfterApi: string, queryString: string): string => {
  const qs = queryString ? `?${queryString}` : "";
  return `${getTargetBase()}${pathAfterApi}${qs}`;
};

const proxyRequest = async (
  req: Request,
  res: ExpressResponse,
  targetPath: string
): Promise<void> => {
  const queryString = req.originalUrl.split("?")[1] ?? "";
  const url = buildTargetUrl(targetPath, queryString);
  const targetBase = getTargetBase();

  const headers: Record<string, string> = {
    accept: req.get("accept") ?? "*/*",
    origin: targetBase,
    referer: `${targetBase}/`,
  };

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    headers["content-type"] = req.get("content-type") ?? "application/json";
    body = req.body !== undefined ? JSON.stringify(req.body) : undefined;
  }

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(url, {
      method: req.method,
      headers,
      body,
      signal: AbortSignal.timeout(env.calcServiceTimeoutMs),
    });
  } catch (err) {
    const message =
      err instanceof Error && err.name === "TimeoutError"
        ? `Calc service timeout after ${env.calcServiceTimeoutMs}ms`
        : `Calc service request failed: ${err instanceof Error ? err.message : String(err)}`;
    res.status(502).json({ error: message });
    return;
  }

  res.status(upstream.status);
  const passThroughHeaders = ["content-type", "cache-control", "etag", "last-modified"];
  for (const name of passThroughHeaders) {
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  }

  if (!upstream.body) {
    res.end();
    return;
  }

  Readable.fromWeb(upstream.body as WebReadableStream<Uint8Array>).pipe(res);
};

router.post("/api/v1/calcIsolation/byProduct", (req, res) =>
  proxyRequest(req, res, "/api/v1/calcIsolation/byProduct")
);

router.get("/api/v1/AllIsolationConstr", (req, res) =>
  proxyRequest(req, res, "/api/v1/AllIsolationConstr")
);

router.get("/api/v1/IsolationConstrMaterials/:code", (req, res) =>
  proxyRequest(
    req,
    res,
    `/api/v1/IsolationConstrMaterials/${encodeURIComponent(req.params.code)}`
  )
);

router.get("/api/v1/constr/:filename", (req, res) =>
  proxyRequest(req, res, `/api/v1/constr/${encodeURIComponent(req.params.filename)}`)
);

router.get("/api/v2/isolationConstructions/props/:code", (req, res) =>
  proxyRequest(
    req,
    res,
    `/api/v2/isolationConstructions/props/${encodeURIComponent(req.params.code)}`
  )
);

// Прайс из 1С: используется в frontend/src/services/priceApi.js (cache + поиск).
router.get("/api/v2/data", (req, res) => proxyRequest(req, res, "/api/v2/data"));

export default router;
