/**
 * Prod-сервер фронта.
 *
 * TLS и публичная маршрутизация по домену — на отдельном gateway-01. Этот процесс:
 *   1) отдаёт статику из /app/dist (собранная vite-бандла);
 *   2) проксирует /api/*, /health, /uploads/* и /commerce/*
 *      в backend-контейнер (сохраняя httpOnly cookies);
 *   3) делает SPA-fallback на index.html для любых non-asset GET-маршрутов.
 *
 * Слушает только HTTP на PORT (дефолт 3004). В docker-compose.prod.yml
 * публикуется на приватном IP prodfront — снаружи недоступен, трафик приходит
 * только от gateway-01.
 */
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import fs from "node:fs";
import path from "node:path";

const PORT = Number(process.env.PORT) || 3004;
const BACKEND_URL = process.env.BACKEND_URL || "http://backend:3006";
const TRUST_PROXY = process.env.TRUST_PROXY || "loopback";
const DIST_DIR = process.env.DIST_DIR || "/app/dist";
const INDEX_HTML = path.join(DIST_DIR, "index.html");

if (!fs.existsSync(INDEX_HTML)) {
  console.error(
    `[frontend] WARN: ${INDEX_HTML} not found. Did you rsync frontend/dist/?`
  );
}

const app = express();

// В production значение — приватный IP/CIDR gateway-01. Loopback остаётся
// безопасным fallback для локального запуска без внешнего reverse proxy.
app.set("trust proxy", TRUST_PROXY);

// Прокси на backend. Не монтируем через app.use("/api", ...) — так express
// стрипает префикс и backend получает `/openapi.json` вместо `/api/openapi.json`.
// Используем pathFilter — path сохраняется один-в-один.
// `/health` тоже проксируем: это backend-ручка, её используют nginx-healthcheck'и
// и мониторинг.
// `/uploads/*` — статика, которую отдаёт сам backend (логотипы и прочие
// пользовательские загрузки из named volume ag_sound_calc_uploads). Без этой
// строки фронт перехватывает их SPA-фолбэком и возвращает index.html.
const backendProxy = createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  xfwd: true,
  // Явная функция вместо glob-массива — однозначно отлавливает /api, /health
  // и /uploads на любой глубине, не полагается на поведение micromatch в разных версиях.
  pathFilter: (pathname) =>
    pathname === "/health" ||
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/uploads/") ||
    pathname === "/commerce" ||
    pathname.startsWith("/commerce/"),
});
app.use(backendProxy);

// Локальный health самого фронт-процесса (не трогает backend) — полезно
// различать «фронт жив, но backend упал».
app.get("/__front_health", (_req, res) => res.json({ ok: true }));

// Статика: хешированные ассеты можно кешировать надолго, index.html — нет.
app.use(
  express.static(DIST_DIR, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache");
      } else {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  })
);

// SPA fallback: любой GET, не попавший в /api и не найденный в static → index.html.
app.get("*", (_req, res, next) => {
  if (!fs.existsSync(INDEX_HTML)) return next(new Error("index.html missing"));
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(INDEX_HTML);
});

const server = app.listen(PORT, () => {
  console.log(`[frontend] listening on :${PORT}, dist=${DIST_DIR}, backend=${BACKEND_URL}`);
});

// Корректное завершение при docker stop / compose restart.
const shutdown = (signal) => {
  console.log(`[frontend] ${signal} received, closing...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
