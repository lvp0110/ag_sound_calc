# Настройка CORS прокси для GitHub Pages

## Проблема

При публикации на GitHub Pages возникают CORS ошибки, так как API сервер `https://constrtodo.ru:3005` не разрешает запросы с домена `https://lvp0110.github.io`.

## Решение: Настройка прокси через Cloudflare Workers

### Шаг 1: Создайте Cloudflare Worker

1. Зарегистрируйтесь на https://workers.cloudflare.com/ (бесплатно)
2. Нажмите **"Create a Worker"**
3. **ВАЖНО:** Скопируйте ВЕСЬ код из файла `cloudflare-worker-simple.js` (начиная с `export default`) и вставьте в редактор Worker
   - Или используйте код из `cloudflare-worker-proxy.js`, но убедитесь, что скопировали ВСЕ, включая `const API_BASE_URL`
4. Нажмите **"Save and Deploy"**
5. Скопируйте URL вашего Worker (например: `https://your-worker.your-subdomain.workers.dev`)

**Примечание:** Если возникают ошибки, используйте упрощенную версию из `cloudflare-worker-simple.js` - она более надежна.

### Шаг 2: Настройте секрет в GitHub

1. Откройте ваш репозиторий на GitHub: https://github.com/lvp0110/ag_sound_calc
2. Перейдите в **Settings** → **Secrets and variables** → **Actions**
3. Нажмите **"New repository secret"**
4. Создайте секрет с именем `VITE_API_PROXY_URL` (или `VITE_API_URL`)
5. В значение вставьте URL вашего Worker + `/api/v1` (обязательно со слешами!)
   - ✅ Правильно: `https://your-worker.workers.dev/api/v1`
   - ❌ Неправильно: `https://your-worker.workers.dev/apiv1` (без слешей)
   - ❌ Неправильно: `https://your-worker.workers.dev/api/v1/` (со слешем в конце)
6. Нажмите **"Add secret"**

**Важно:** URL должен заканчиваться на `/api/v1` (без слеша в конце, но со слешами между `api` и `v1`)

### Шаг 3: Пересоберите проект

1. Сделайте любой коммит и push в ветку `main`, или
2. Перейдите в **Actions** → выберите последний workflow → **Run workflow** → **Run workflow**

### Шаг 4: Проверьте результат

1. Откройте сайт: https://lvp0110.github.io/ag_sound_calc/
2. Откройте консоль браузера (F12)
3. Попробуйте выполнить расчет конструкции
4. В консоли должно появиться: `[API] Using proxy: ...`
5. CORS ошибки должны исчезнуть

## Альтернативные решения

### Вариант 1: Настроить CORS на API сервере

Если у вас есть доступ к серверу `https://constrtodo.ru:3005`, попросите администратора добавить домен `https://lvp0110.github.io` в список разрешенных источников.

### Вариант 2: Использовать другой прокси-сервер

Можно использовать любой другой CORS прокси, например:
- https://cors-anywhere.herokuapp.com/ (не рекомендуется для production)
- Собственный прокси-сервер

## Проверка работы прокси

После настройки прокси, в консоли браузера вы должны увидеть:
- `[API] Using proxy: https://your-worker.workers.dev/api/v1` - прокси работает
- `[API] No proxy configured, using direct URL (CORS may fail)` - прокси не настроен

## Важно

- URL прокси должен заканчиваться на `/api/v1` (например: `https://your-worker.workers.dev/api/v1`)
- После изменения секрета нужно пересобрать проект (сделать push или запустить workflow вручную)
- Cloudflare Workers бесплатный план позволяет до 100,000 запросов в день

