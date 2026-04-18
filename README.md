# ag_sound_calc

Калькулятор акустических конструкций с генерацией коммерческих предложений (КП). Включает React-фронт, Node/Express-бэк с Prisma + PostgreSQL и интеграцию с внешним сервисом расчёта.

---

## Стек

| Слой | Технологии |
|------|------------|
| Frontend | React 19, Vite, React Router 7 |
| Backend | Node.js, Express, TypeScript, Prisma |
| Auth | JWT в httpOnly cookies (access + refresh) |
| DB | PostgreSQL 16 (в Docker) |
| API-документация | OpenAPI + Swagger UI (`@asteasolutions/zod-to-openapi`) |
| Внешний сервис | `dev3.constrtodo.ru:3005` — расчёт материалов |
| DB UI | Prisma Studio, Adminer |

---

## Требования

- **Node.js** ≥ 20
- **npm** ≥ 10
- **Docker Desktop** (для PostgreSQL + Adminer)
- **make** (предустановлен на macOS/Linux)

---

## Быстрый старт

```bash
# 1) Первая инициализация: зависимости, .env, БД, миграции
make setup

# 2) Запустить стек (postgres уже поднят, backend + frontend в фоне того же терминала)
make dev
```

После `make dev`:

| Сервис | URL |
|--------|-----|
| Frontend | [http://localhost:5173](http://localhost:5173) |
| Backend API | [http://localhost:3006](http://localhost:3006) |
| Swagger UI | [http://localhost:3006/api/docs](http://localhost:3006/api/docs) |
| Adminer (SQL) | [http://localhost:8080](http://localhost:8080) |
| PostgreSQL | `localhost:5433` (в контейнере `ag_sound_calc_postgres`) |
| Prisma Studio | [http://localhost:5555](http://localhost:5555) (после `make db-ui`) |

`Ctrl-C` в терминале `make dev` останавливает backend и frontend. PostgreSQL в Docker продолжит работать — отключить его можно `make db-down`.

---

## Команды (Makefile)

| Команда | Описание |
|---------|----------|
| `make help` | Список всех команд |
| `make setup` | Первая инициализация: install + env + БД + миграции |
| `make install` | Установить зависимости (backend + frontend) |
| `make env` | Создать `backend/.env` из `.env.example`, если отсутствует |
| `make db-up` | Поднять `postgres` и `adminer` в Docker и дождаться healthcheck |
| `make db-down` | Остановить контейнеры docker compose |
| `make db-migrate` | Применить миграции Prisma к локальной БД |
| `make db-reset` | ⚠️ Полностью пересоздать БД (все данные будут стёрты) |
| `make db-ui` | Запустить Prisma Studio на :5555 |
| `make backend` | Запустить только backend (tsx watch) |
| `make frontend` | Запустить только frontend (vite dev) |
| `make dev` | Запустить всё: postgres + backend + frontend |
| `make stop` | Убить зависшие backend/frontend процессы |
| `make build` | Production-сборка: `tsc` (backend) + `vite build` (frontend) |
| `make clean` | Удалить `node_modules` и `dist` в backend и frontend |
| `make status` | Контейнеры + занятость портов 3006/5173/5433/5555/8080 |

---

## Работа с БД

### Миграции

```bash
# Применить существующие миграции
make db-migrate

# Создать новую миграцию (после правки backend/prisma/schema.prisma)
cd backend && npx prisma migrate dev --name <name>

# Полный сброс (⚠️ удаляет все данные)
make db-reset
```

### Просмотр данных

**Prisma Studio** — удобно для повседневной работы, знает схему, рендерит JSONB деревом:
```bash
make db-ui
# → http://localhost:5555
```

**Adminer** — произвольный SQL, EXPLAIN, импорт/экспорт:
```bash
# уже поднят после `make db-up`
# → http://localhost:8080
# System: PostgreSQL, Server: postgres, User: postgres, Password: postgres, Database: ag_sound_calc
```

---

## API

- Swagger UI: [http://localhost:3006/api/docs](http://localhost:3006/api/docs)
- OpenAPI JSON: [http://localhost:3006/api/openapi.json](http://localhost:3006/api/openapi.json)

Основные группы ручек:

| Группа | Пути |
|--------|------|
| **Auth** | `POST /api/auth/{register,login,refresh,logout}` |
| **Users** | `GET/PUT /api/users/me` |
| **Offers** | `POST/GET /api/offers`, `GET/PATCH/DELETE /api/offers/:id`, `POST /api/offers/:id/clone` |
| **Calc (proxy)** | Прозрачно проксируют на внешний `dev3.constrtodo.ru:3005`: `POST /api/v1/calcIsolation/byProduct`, `GET /api/v1/AllIsolationConstr`, `GET /api/v1/IsolationConstrMaterials/{code}`, `GET /api/v1/constr/{filename}`, `GET /api/v2/isolationConstructions/props/{code}` |
| **Health** | `GET /health` |

Аутентификация — через httpOnly cookies `accessToken` (15 min) и `refreshToken` (30 days). Все запросы с фронта идут с `credentials: 'include'`; refresh при 401 выполняется автоматически клиентом.

---

## Структура проекта

```
ag_sound_calc/
├── backend/                        ← Node/Express + Prisma
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── config/env.ts
│   │   ├── docs/                   ← Zod + Swagger
│   │   ├── lib/prisma.ts
│   │   ├── middleware/requireAuth.ts
│   │   ├── routes/                 ← auth, users, offers, calc (proxy)
│   │   ├── services/               ← calcService, offerRecalc
│   │   ├── utils/                  ← tokens, userDto
│   │   └── index.ts
│   ├── .env.example
│   └── package.json
├── frontend/                       ← React + Vite
│   ├── src/
│   │   ├── components/             ← Calculator, KpPage, KpList, LoginModal, RegisterPage, AppHeader, …
│   │   ├── context/AuthContext.jsx
│   │   ├── services/               ← apiClient, authApi, offersApi, constructionApi
│   │   ├── utils/offerMapper.js
│   │   └── ...
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── docker-compose.yml              ← postgres + adminer
├── Makefile                        ← все команды разработки
├── PROJECT_PLAN.md                 ← архитектурный план
├── DB_SCHEMA.html                  ← схема данных (визуал)
└── .github/workflows/deploy.yml    ← GitHub Pages для фронта
```

---

## Переменные окружения

Backend — `backend/.env` (создаётся из `.env.example` через `make env`):

| Переменная | Дефолт | Описание |
|------------|--------|----------|
| `NODE_ENV` | `development` | — |
| `PORT` | `3006` | Порт backend-API |
| `CORS_ORIGIN` | `http://localhost:5173` | Origin фронта для CORS (с `credentials: true`) |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5433/ag_sound_calc?schema=public` | Соединение с PostgreSQL |
| `JWT_ACCESS_SECRET` | `dev_access_secret_change_me` | Секрет для access токена — **в проде обязательно заменить** |
| `JWT_REFRESH_SECRET` | `dev_refresh_secret_change_me` | Аналогично — **в проде заменить** |
| `ACCESS_TOKEN_EXPIRES_IN` | `15m` | TTL access cookie |
| `REFRESH_TOKEN_EXPIRES_IN` | `30d` | TTL refresh cookie |
| `CALC_SERVICE_URL` | `https://dev3.constrtodo.ru:3005` | База внешнего сервиса расчёта |
| `CALC_SERVICE_TIMEOUT_MS` | `15000` | Таймаут запроса к calc-сервису |

Frontend (опционально — через `frontend/.env.local`):

| Переменная | Дефолт | Описание |
|------------|--------|----------|
| `VITE_API_URL` | `http://localhost:3006` | URL backend-API |

---

## Запуск без Make

На случай если `make` недоступен:

```bash
# 1) Poднять БД и Adminer
docker compose up -d postgres adminer

# 2) Установить зависимости
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 3) Создать backend/.env
cp backend/.env.example backend/.env

# 4) Применить миграции
cd backend && npx prisma migrate deploy && cd ..

# 5) Запустить backend и frontend в отдельных терминалах
cd backend && npm run dev          # терминал 1
cd frontend && npm run dev         # терминал 2
```

---

## Production-сборка

```bash
make build
```

Генерирует:
- `backend/dist/` — скомпилированный TypeScript (запуск: `cd backend && npm start`).
- `frontend/dist/` — статический фронт (раздаётся любым CDN/nginx или GitHub Pages).

---

## Деплой фронта на GitHub Pages

Фронт автоматически собирается и публикуется через [.github/workflows/deploy.yml](.github/workflows/deploy.yml) на каждый push в `main`.

Настройка один раз:
1. В `Settings` → `Pages` → `Source` = **GitHub Actions**.
2. После первого успешного деплоя ссылка: https://lvp0110.github.io/ag_sound_calc/

**Важно:** фронт для прода общается напрямую с `dev3.constrtodo.ru:3005`, так что на backend должен быть CORS для `https://lvp0110.github.io`. Если нужно чтобы прод-фронт смотрел на ваш задеплоенный backend — соберите с `VITE_API_URL=https://your-api.example.com npm run build`.

---

## Частые проблемы

**Docker не запущен**
`make db-up` выдаст:
```
✗ Docker не запущен. Запустите Docker Desktop.
```
→ Запустите Docker Desktop и повторите.

**Порт 5432 занят локальным Postgres**
Контейнер замаплен на **5433**, так что конфликта с локальным Postgres нет. Если в `.env` остался `localhost:5432` от старой установки — замените на `5433`.

**401 Unauthorized после логина при запросах с фронта**
Проверьте, что:
- backend `.env` имеет `CORS_ORIGIN=http://localhost:5173` (порт фронта совпадает);
- браузер не блокирует cookies третьей стороны (для localhost обычно ок).

**Ошибка валидации при сохранении КП**
Обычно означает, что payload не совпадает со схемой. Ответ backend теперь содержит `issues[]` с путями — по ним видно, какое именно поле не прошло.

**Зависшие dev-процессы после Ctrl-C**
```bash
make stop      # убивает tsx watch и vite
make status    # показывает что ещё крутится
```

---

## Лицензия

Private project.
