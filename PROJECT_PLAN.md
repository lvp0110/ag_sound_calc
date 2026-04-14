# План проекта: ag_sound_calc — Backend + Auth + Offer-first КП

## Описание

Доработка существующего React-приложения (калькулятор акустических конструкций с генерацией КП). Цель — реализовать проект целиком: backend, БД, авторизацию, хранение офферов и повторный расчёт материалов с актуальными ценами.

Ключевая модель домена — `Offer` (см. `types.ts`). Оффер создаётся сразу после запуска формирования КП из калькулятора, затем пользователь попадает на готовую страницу `/kp/:id`.

---

## Стек технологий


| Слой            | Технология                                                   | Обоснование                                     |
| --------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| Frontend        | React 19 + React Router 7 (существующий)                     | Без смены фреймворка                            |
| Backend         | **Node.js + Express + TypeScript**                           | Единый язык с фронтом, быстрый старт + типобезопасность |
| База данных     | **PostgreSQL**                                               | Реляционная модель + JSONB для вложенных данных |
| ORM             | **Prisma**                                                   | Type-safe миграции, удобный DX                  |
| Авторизация     | **JWT** (access token) + **httpOnly Cookie** (refresh token) | Безопасный и стандартный поток auth             |
| Хэширование     | **bcrypt**                                                   | Стандарт хранения паролей                       |
| PDF             | **Puppeteer**                                                | Рендер КП-страницы в PDF                        |
| Контейнеризация | **Docker + Docker Compose**                                  | Единый запуск postgres + backend                |
| Конфигурация    | **dotenv**                                                   | Управление окружением                           |


---

## Принцип хранения данных расчёта (Offer-first)

Храним не полный результат расчёта, а входные параметры `calc_params` для каждой конструкции (`Construction`) и пользовательские правки цен материалов в `materials`.

При каждом открытии `/kp/:id`:

1. Бэкенд берёт `calc_params` всех конструкций оффера.
2. Вызывает внешний сервис `/api/v1/calcIsolation/byProduct` (контракт не меняется).
3. Получает актуальные материалы/цены.
4. Накладывает сохранённые пользовательские override (только где пользователь редактировал цены).
5. Возвращает готовые данные фронту.

`sessionStorage` передачи расчетов не используются.

**Структура `calc_params` (на одну конструкцию):**

```javascript
{
  Code: string,
  LenX: number,
  LenY: number,
  LenZ: number,
  AddCeilShift: number,
  step: number,
  dframe: boolean,
  Area: number,
  Perimeter: number,
  Openings: [{ lenX, lenZ, Type }],
}
```

---

## Схема базы данных

### Таблица `users`


| Поле             | Тип                          | Описание                 |
| ---------------- | ---------------------------- | ------------------------ |
| `id`             | UUID PK                      | Уникальный идентификатор |
| `full_name`      | VARCHAR(255) NOT NULL        | ФИО менеджера            |
| `phone`          | VARCHAR(50)                  | Телефон                  |
| `email`          | VARCHAR(255) UNIQUE NOT NULL | Почта (логин)            |
| `office_address` | TEXT                         | Адрес офиса              |
| `password_hash`  | VARCHAR(255) NOT NULL        | Хэш пароля               |
| `created_at`     | TIMESTAMP                    | Дата создания            |
| `updated_at`     | TIMESTAMP                    | Дата обновления          |


### Таблица `offers`


| Поле               | Тип                | Описание                       |
| ------------------ | ------------------ | ------------------------------ |
| `id`               | UUID PK            | ID оффера                      |
| `user_id`          | UUID FK → users.id | Владелец оффера                |
| `title`            | VARCHAR(255)       | Заголовок КП                   |
| `manager_name`     | VARCHAR(255)       | ФИО менеджера (snapshot)       |
| `phone`            | VARCHAR(50)        | Телефон                        |
| `email`            | VARCHAR(255)       | Почта                          |
| `office_address`   | TEXT               | Адрес офиса                    |
| `kp_date`          | VARCHAR(50)        | Дата КП                        |
| `object_name`      | TEXT               | Объект                         |
| `logo_url`         | TEXT               | Логотип КП                     |
| `region`           | VARCHAR(120)       | Регион                         |
| `markup_percent`   | NUMERIC(6,2)       | Наценка (%)                    |
| `discount_percent` | NUMERIC(6,2)       | Скидка (%)                     |
| `services`         | JSONB              | `Offer.services` (`Service[]`) |
| `created_at`       | TIMESTAMP          | Дата создания                  |
| `updated_at`       | TIMESTAMP          | Дата обновления                |


### Таблица `offer_constructions`


| Поле          | Тип                 | Описание                                            |
| ------------- | ------------------- | --------------------------------------------------- |
| `id`          | UUID PK             | ID записи                                           |
| `offer_id`    | UUID FK → offers.id | Ссылка на оффер                                     |
| `position`    | INTEGER NOT NULL    | Порядок конструкции внутри оффера                   |
| `calc_params` | JSONB NOT NULL      | Параметры запроса `/api/v1/calcIsolation/byProduct` |
| `materials`   | JSONB               | `Construction.materials` (`Material[]`)             |
| `montage`     | JSONB               | `Construction.montage` (`Service[]`)                |
| `created_at`  | TIMESTAMP           | Дата создания                                       |
| `updated_at`  | TIMESTAMP           | Дата обновления                                     |


Ограничения и индексы:

- `UNIQUE(offer_id, position)`;
- индекс по `offer_id`;
- FK `offer_id -> offers.id` с `ON DELETE CASCADE`.

---

## API Endpoints

### Авторизация


| Метод | Путь                 | Тело                                                    | Описание                |
| ----- | -------------------- | ------------------------------------------------------- | ----------------------- |
| POST  | `/api/auth/register` | `{ full_name, email, phone, office_address, password }` | Регистрация             |
| POST  | `/api/auth/login`    | `{ email, password }`                                   | Вход → токены           |
| POST  | `/api/auth/refresh`  | *(cookie refresh)*                                      | Обновление access token |
| POST  | `/api/auth/logout`   | —                                                       | Выход                   |


### Пользователь *(auth)*


| Метод | Путь            | Тело                                          | Описание             |
| ----- | --------------- | --------------------------------------------- | -------------------- |
| GET   | `/api/users/me` | —                                             | Текущий пользователь |
| PUT   | `/api/users/me` | `{ full_name, phone, email, office_address }` | Обновить профиль     |


### Офферы / КП *(auth)*


| Метод | Путь                    | Тело                                            | Описание                                                      |
| ----- | ----------------------- | ----------------------------------------------- | ------------------------------------------------------------- |
| POST  | `/api/offers`           | `{ form, offerDraft }`                          | Создать оффер + конструкции, выполнить расчёт, вернуть модель |
| GET   | `/api/offers`           | —                                               | Список офферов пользователя                                   |
| GET   | `/api/offers/:id`       | —                                               | Оффер + пересчитанные материалы                               |
| PATCH | `/api/offers/:id`       | `{ form, services, constructions, total_cost }` | Сохранить правки                                              |
| POST  | `/api/offers/:id/clone` | -                                               | Создать новый оффер на основе существующего                   |
| GET   | `/api/offers/:id/pdf`   | —                                               | Скачать PDF                                                   |


Примечание: внешний `/api/v1/calcIsolation/byProduct` не меняется.

---

## Маршруты фронтенда


| Маршрут     | Компонент          | Описание                                          |
| ----------- | ------------------ | ------------------------------------------------- |
| `/calc`     | `Calculator.jsx`   | Инициирует создание оффера (`POST /api/offers`)   |
| `/kp/:id`   | `KpPage.jsx`       | Основная страница просмотра/редактирования оффера |
| `/kp/list`  | `KpList.jsx`       | Список офферов                                    |
| `/register` | `RegisterPage.jsx` | Регистрация                                       |


---

## Логика работы приложения

### Создание оффера

1. Пользователь заканчивает расчёты в калькуляторе (`Construction[]`).
2. Фронт делает `POST /api/offers`.
3. Бэкенд создаёт оффер.
4. Фронт переходит на `/kp/:id`.

### Работа с `/kp/:id`

- На загрузке: `GET /api/offers/:id`.
- Бэкенд всегда пересчитывает материалы по `calc_params`.
- Бэкенд накладывает сохранённые правки цен из `constructions[].materials`.
- Пользователь редактирует данные, затем сохраняет изменения с помощью `PATCH /api/offers/:id`.

### Создание на основе

- Из `/kp/list` или карточки оффера пользователь вызывает `POST /api/offers/:id/clone`.
- Бэкенд создаёт новый оффер на основе исходного, копирует все поля.
- После создания фронт получает новый `offerId` и открывает новый `/kp/:offerId`.

---

## Флоу (Mermaid)

```mermaid
flowchart LR
  calculator[CalculatorPage] -->|"POST /api/offers"| backendCreate[BackendCreateOffer]
  backendCreate --> dbOffers[(offersAndOfferConstructions)]
  backendCreate --> calcService[/api/v1/calcIsolation/byProduct]
  calcService --> backendCompose[BackendComposeOfferView]
  backendCompose --> kpPage[kpByIdPage]
  kpPage -->|"PATCH /api/offers/:id"| backendUpdate[BackendUpdateOffer]
  backendUpdate --> dbOffers
  kpPage -->|"GET /api/offers/:id"| backendReload[BackendRecalculateAndMergeOverrides]
  backendReload --> calcService
```



---

## Структура папок

```text
ag_sound_calc/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   └── offers.ts
│   │   ├── middleware/
│   │   │   └── requireAuth.ts
│   │   └── index.ts
│   ├── Dockerfile
│   ├── .env
│   └── package.json
├── src/
│   ├── context/AuthContext.jsx
│   ├── components/LoginModal.jsx
│   ├── components/KpList.jsx
│   ├── components/RegisterPage.jsx
│   ├── components/KpPage.jsx
│   ├── services/authApi.js
│   ├── services/offersApi.js
│   ├── utils/offerMapper.ts
│   ├── App.jsx
│   └── types.ts
├── docker-compose.yml
├── PROJECT_PLAN.md
└── DB_SCHEMA.html
```

---

## Пошаговые этапы реализации

### Этап 0: Инфраструктура

- `docker-compose.yml`: `postgres`, `backend`.
- Базовый Express + подключение Prisma + env.
- Настройка TypeScript для backend (`tsconfig`, scripts `dev/build/start`).

### Этап 1: Модель данных

- Prisma-модели `User`, `Offer`, `OfferConstruction`.
- Миграции и индексы.

### Этап 2: Auth

- `/api/auth/*`, `/api/users/me`, middleware `requireAuth` (TypeScript).

### Этап 3: Offer API

- `POST/GET/PATCH /api/offers`, `GET /api/offers/:id/pdf`.
- `POST /api/offers/:id/clone` для сценария "Создать на основе".
- Серверный пересчёт + merge override.

### Этап 4: Frontend auth

- `AuthContext`, `LoginModal`, `RegisterPage`.

### Этап 5: Интеграция калькулятора

- Формирование `offerDraft`.
- `POST /api/offers` и redirect на `/kp/:id`.

### Этап 6: Страницы оффера

- `/kp/:id`: загрузка, редактирование, сохранение.
- `/kp/list`: список, создание на основе.

---

## Верификация

1. Регистрация/логин работают, токены выдаются.
2. Создание оффера из калькулятора ведёт на `/kp/:id`.
3. На `/kp/:id` материалы приходят с серверного расчёта.
4. `PATCH /api/offers/:id` сохраняет правки в `services`, `constructions[].materials`, `constructions[].montage`.
5. После reload пересчёт актуализируется, override применяются.
6. Пользователь видит только свои офферы.
7. `POST /api/offers/:id/clone` создаёт новый оффер и возвращает новый `id`; переход на новый `/kp/:id` успешен.

---

*Схема БД и флоучарт приложения: [DB_SCHEMA.html](./DB_SCHEMA.html)*