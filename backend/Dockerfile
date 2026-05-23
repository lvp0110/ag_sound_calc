# syntax=docker/dockerfile:1

# ─── build stage ─────────────────────────────────────────────────────────────
# Debian slim вместо alpine — bundled Chromium у puppeteer собран под glibc.
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Кэш Chromium кладём внутри /app, чтобы переехать в runtime-стадию COPY-ем.
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

# Все зависимости (включая dev) — нужны tsc, prisma, @types/*.
# postinstall у puppeteer выкачает Chromium в PUPPETEER_CACHE_DIR.
COPY package.json package-lock.json ./
RUN npm ci

# Сначала prisma-схема — RUN prisma generate сделает код клиента.
COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build
# /app/dist — скомпилированный JS.

# ─── runtime stage ───────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

# Системные библиотеки headless Chromium + кириллические шрифты для рендера КП.
# Без font'ов кириллица в PDF превращается в "тофу" (квадратики).
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      fonts-liberation \
      fonts-dejavu-core \
      fonts-noto-color-emoji \
      libnss3 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libcups2 \
      libdrm2 \
      libxkbcommon0 \
      libxcomposite1 \
      libxdamage1 \
      libxfixes3 \
      libxrandr2 \
      libgbm1 \
      libpango-1.0-0 \
      libcairo2 \
      libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Только prod-зависимости. Puppeteer postinstall попытается выкачать Chromium
# заново — пропускаем, бинарь приедет COPY-ем из build-стадии.
COPY package.json package-lock.json ./
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci --omit=dev

# Сгенерированный Prisma-клиент из build-стадии (чтобы не тащить prisma CLI в prod).
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Chromium из puppeteer-postinstall build-стадии.
COPY --from=build /app/.cache/puppeteer ./.cache/puppeteer

# Скомпилированный код + схема/миграции (нужны для `prisma migrate deploy`).
COPY --from=build /app/dist ./dist
COPY prisma ./prisma

# Backend доступен только во внутренней docker network — порт на хост не публикуется.
EXPOSE 3006

USER node

CMD ["node", "dist/index.js"]
