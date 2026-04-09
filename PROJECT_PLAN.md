# План проекта: ag_sound_calc — Backend + Auth + История КП

## Описание

Доработка существующего React-приложения (калькулятор акустических конструкций с генерацией КП). Цель — добавить бэкенд, базу данных и полный цикл работы с коммерческими предложениями: создание, хранение, просмотр истории, копирование. Для каждого сотрудника — отдельная учётная запись.

---

## Стек технологий

| Слой | Технология | Обоснование |
|---|---|---|
| Frontend | React 19 + React Router 7 (существующий) | Без смены фреймворка |
| Backend | **Node.js + Express** | Единый язык с фронтом, быстрый старт |
| База данных | **PostgreSQL** | Реляционная, JSONB для динамических полей КП |
| ORM | **Prisma** | Type-safe миграции, отличный DX |
| Авторизация | **JWT** (access token в памяти) + **httpOnly Cookie** (refresh token) | Защита от XSS |
| Хэширование | **bcrypt** | Стандарт для паролей |
| PDF | **Puppeteer** | Рендерит существующую HTML-страницу КП в PDF |
| Контейнеризация | **Docker + Docker Compose** | postgres + express (API + статика фронта) |
| Конфигурация | **dotenv** | Управление окружением |

---

## Принцип хранения данных расчёта

Вместо хранения результатов расчёта в БД — сохраняем только **параметры** вызова `/api/v1/calcIsolation/byProduct`. При каждом открытии КП расчёт выполняется заново → данные всегда актуальны (актуальные цены, нормы расхода).

Переход с калькулятора на страницу создания КП выполняется через URL:
```
/kp?p=<base64(JSON(calc_params))>
```

**Структура `calc_params` (массив конструкций):**
```javascript
[
  {
    // Параметры для API /api/v1/calcIsolation/byProduct
    Code: string,          // Код конструкции (напр. "AG.W101")
    LenX: number,          // мм
    LenY: number,          // мм
    LenZ: number,          // мм
    AddCeilShift: number,
    step: number,          // 400 или 600
    dframe: boolean,
    Area: number,          // м²
    Perimeter: number,     // м
    Openings: [{ lenX, lenZ, Type }],

    // Метаданные для отображения
    key_id: number,        // уникальный ID конструкции в рамках КП
    title: string,
    type: string,          // F / C / L / W
    ag_id: string
  }
]
```

---

## Схема базы данных

### Таблица `users`

| Поле | Тип | Описание |
|---|---|---|
| `id` | UUID PK | Уникальный идентификатор |
| `full_name` | VARCHAR(255) NOT NULL | ФИО менеджера |
| `phone` | VARCHAR(50) | Телефон |
| `email` | VARCHAR(255) UNIQUE NOT NULL | Почта (логин) |
| `office_address` | TEXT | Адрес офиса |
| `password_hash` | VARCHAR(255) NOT NULL | Хэш пароля |
| `created_at` | TIMESTAMP | Дата создания |
| `updated_at` | TIMESTAMP | Дата обновления |

### Таблица `kp`

| Поле | Тип | Описание |
|---|---|---|
| `id` | UUID PK | Уникальный идентификатор |
| `user_id` | UUID FK → users.id | Владелец КП |
| `title` | VARCHAR(255) | Заголовок (авто: "КП от {date} / {object}") |
| `manager_name` | VARCHAR(255) | ФИО менеджера (snapshot) |
| `phone` | VARCHAR(50) | Телефон |
| `email` | VARCHAR(255) | Почта |
| `office_address` | TEXT | Адрес офиса |
| `kp_date` | VARCHAR(50) | Дата КП |
| `object_name` | TEXT | Объект |
| `calc_params` | JSONB NOT NULL | Параметры для повторного расчёта (см. выше) |
| `price_overrides` | JSONB | Ручные цены менеджера `{ [Code]: { KpPricePerM2, KpPricePerUnit } }` |
| `montage_data` | JSONB | Монтаж `{ [key_id]: { price, quantity, unit } }` |
| `service_rows` | JSONB | Доп. услуги `[{ id, preset, name, price, quantity, unit }]` |
| `total_cost` | DECIMAL(12,2) | Итоговая сумма (snapshot для списка) |
| `created_at` | TIMESTAMP | Дата создания |

> `calc_params` хранит только входные параметры (компактно). Фактический состав материалов и количества всегда вычисляются заново при открытии КП.

---

## API Endpoints

### Авторизация
| Метод | Путь | Тело | Описание |
|---|---|---|---|
| POST | `/api/auth/register` | `{ full_name, email, phone, office_address, password }` | Регистрация |
| POST | `/api/auth/login` | `{ email, password }` | Вход → JWT + cookie |
| POST | `/api/auth/refresh` | *(cookie)* | Обновление access token |
| POST | `/api/auth/logout` | — | Выход |

### Пользователь *(требует auth)*
| Метод | Путь | Тело | Описание |
|---|---|---|---|
| GET | `/api/users/me` | — | Данные текущего пользователя |
| PUT | `/api/users/me` | `{ full_name, phone, email, office_address }` | Обновить данные |

### КП *(требует auth)*
| Метод | Путь | Тело | Описание |
|---|---|---|---|
| POST | `/api/kp` | `{ form, calc_tables, montage_data, service_rows, total_cost }` | Создать КП |
| GET | `/api/kp` | — | Список КП текущего пользователя |
| GET | `/api/kp/:id` | — | Одно КП (только своё) |
| GET | `/api/kp/:id/pdf` | — | Скачать КП в PDF |

---

## Маршруты фронтенда

| Маршрут | Компонент | Описание |
|---|---|---|
| `/calc` | `Calculator.jsx` | Калькулятор (без изменений) |
| `/kp` | `KpPage.jsx` | Создание КП (требует auth, показывает LoginModal) |
| `/kp/list` | `KpList.jsx` | Список КП текущего пользователя |
| `/kp/:id` | `KpView.jsx` | Просмотр КП (read-only) |
| `/register` | `RegisterPage.jsx` | Регистрация нового пользователя |

---

## Логика работы приложения

### Создание КП (`/kp`)
1. Пользователь переходит на `/kp`
2. Если не авторизован → показывается `LoginModal`
3. После входа данные пользователя подставляются в форму (ФИО, телефон, почта, адрес)
4. Пользователь редактирует поля и таблицы (из sessionStorage от калькулятора)
5. Нажимает "Сформировать КП" → `POST /api/kp` → redirect на `/kp/list`

### Список КП (`/kp/list`)
- Отображаются карточки: дата, объект, сумма, менеджер
- Клик на карточку → `/kp/:id` (просмотр)
- "Создать на основе" у карточки → данные записываются в sessionStorage → redirect на `/kp`
- "Новое КП" → очистить sessionStorage → `/kp`

### Просмотр КП (`/kp/:id`)
- Read-only отображение (та же вёрстка, без полей ввода)
- "Создать на основе" → sessionStorage ← данные КП → redirect на `/kp`
- "Скачать PDF" → `GET /api/kp/:id/pdf`

---

## Структура папок

```
ag_sound_calc/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── users.js
│   │   │   └── kp.js
│   │   ├── middleware/
│   │   │   └── requireAuth.js
│   │   └── index.js          ← Express сервер + static dist/
│   ├── Dockerfile
│   ├── .env
│   └── package.json
├── src/                      ← существующий фронтенд
│   ├── context/
│   │   └── AuthContext.jsx   (новый)
│   ├── components/
│   │   ├── LoginModal.jsx    (новый)
│   │   ├── KpList.jsx        (новый)
│   │   ├── KpView.jsx        (новый)
│   │   ├── RegisterPage.jsx  (новый)
│   │   └── KpPage.jsx        (изменён)
│   ├── services/
│   │   └── authApi.js        (новый)
│   └── App.jsx               (изменён)
├── docker-compose.yml        ← postgres + backend
├── PROJECT_PLAN.md
└── DB_SCHEMA.html
```

---

## Пошаговые этапы реализации

### Этап 0: Docker Compose и инфраструктура
- `docker-compose.yml` — сервисы: `postgres`, `backend`
- `backend/Dockerfile` — Node.js + Puppeteer + сборка фронта (`npm run build`) → `dist/`
- Express раздаёт `dist/` как статику + SPA fallback
- Vite proxy `/api/*` используется только в dev-режиме

### Этап 1: Настройка бэкенда
- Создать `backend/`, инициализировать `npm`
- Установить: `express`, `prisma`, `@prisma/client`, `bcrypt`, `jsonwebtoken`, `cors`, `dotenv`, `cookie-parser`
- `prisma/schema.prisma` — модели `User`, `Kp`
- `prisma migrate dev` — создать БД и таблицы
- Базовый Express сервер с CORS и middleware

### Этап 2: Auth endpoints
- `POST /api/auth/register` — bcrypt.hash(password), создать user
- `POST /api/auth/login` — bcrypt.compare, выдать access JWT + refresh в httpOnly cookie
- `POST /api/auth/refresh` — проверить cookie, выдать новый access token
- Middleware `requireAuth` — валидация JWT из заголовка `Authorization: Bearer <token>`
- `GET /api/users/me`, `PUT /api/users/me`

### Этап 3: КП endpoints
- `POST /api/kp` — сохранить КП для `req.user.id`
- `GET /api/kp` — список КП пользователя (без тяжёлых JSONB-полей)
- `GET /api/kp/:id` — полные данные (проверить `user_id === req.user.id`)
- `GET /api/kp/:id/pdf` — Puppeteer рендерит страницу, возвращает PDF

### Этап 4: Frontend — Auth
- `AuthContext.jsx` — хранить `user`, `accessToken`, `login()`, `logout()`
- `authApi.js` — fetch-хелперы с `Authorization: Bearer <token>`
- `LoginModal.jsx` — форма входа
- `RegisterPage.jsx` — страница `/register`
- Обновить `App.jsx` — `AuthProvider` + новые маршруты

### Этап 5: Интеграция `/kp`
- Проверка авторизации при загрузке → `LoginModal`
- Подстановка данных пользователя в форму после входа
- Кнопка "Сформировать КП" → `POST /api/kp` → redirect `/kp/list`

### Этап 6: Страница `/kp/list`
- `KpList.jsx` — список карточек КП
- Клик → `/kp/:id`, "Создать на основе" → sessionStorage → `/kp`
- "Новое КП" → очистить sessionStorage → `/kp`

### Этап 7: Страница `/kp/:id`
- `KpView.jsx` — read-only отображение данных КП
- Кнопка "Создать на основе" → sessionStorage → `/kp`
- Кнопка "Скачать PDF" → `GET /api/kp/:id/pdf`

---

## Верификация

1. `curl -X POST /api/auth/register` → 201, получен токен
2. `curl -X POST /api/auth/login` → токен + cookie
3. `curl /api/users/me -H "Authorization: Bearer <token>"` → данные пользователя
4. Открыть `/kp` без авторизации → модалка входа
5. Войти → данные пользователя подставились в форму
6. "Сформировать КП" → redirect на `/kp/list` → КП в списке
7. Клик на КП → read-only просмотр
8. "Создать на основе" → форма с заполненными данными
9. Войти как другой пользователь → его КП недоступны первому

---

*Схема БД и флоучарт приложения: [DB_SCHEMA.html](./DB_SCHEMA.html)*
