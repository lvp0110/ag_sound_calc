# syntax=docker/dockerfile:1

# ─── build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Все зависимости (включая dev) — нужны tsc, prisma, @types/*.
COPY package.json package-lock.json ./
RUN npm ci

# Сначала prisma-схема — RUN prisma generate сделает код клиента.
COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build
# /app/dist — скомпилированный JS.

# ─── runtime stage ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Только prod-зависимости.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Сгенерированный Prisma-клиент из build-стадии (чтобы не тащить prisma CLI в prod).
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Скомпилированный код + схема/миграции (нужны для `prisma migrate deploy`).
COPY --from=build /app/dist ./dist
COPY prisma ./prisma

# Backend доступен только во внутренней docker network — порт на хост не публикуется.
EXPOSE 3006

USER node

CMD ["node", "dist/index.js"]
