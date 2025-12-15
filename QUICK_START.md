# Быстрый старт: Создание прокси за 5 минут

## ✅ Чеклист

### 1. Создание прокси (2 минуты)

- [ ] Откройте https://workers.cloudflare.com/ и зарегистрируйтесь (бесплатно)
- [ ] Нажмите "Create a Worker"
- [ ] Удалите весь код в редакторе
- [ ] Откройте файл `cloudflare-worker-proxy.js` в этом проекте
- [ ] Скопируйте весь код из файла и вставьте в редактор Cloudflare
- [ ] Нажмите "Save and Deploy"
- [ ] Скопируйте URL вашего Worker (например: `https://my-proxy.workers.dev`)

### 2. Настройка секрета в GitHub (1 минута)

- [ ] Откройте ваш репозиторий на GitHub
- [ ] Перейдите: **Settings** → **Secrets and variables** → **Actions**
- [ ] Нажмите "New repository secret"
- [ ] **Name**: `VITE_API_PROXY_URL`
- [ ] **Secret**: `https://your-worker-url.workers.dev/api/v1`
  - Замените `your-worker-url.workers.dev` на ваш реальный URL Worker
  - Добавьте `/api/v1` в конце
- [ ] Нажмите "Add secret"

### 3. Пересборка проекта (1 минута)

- [ ] Вернитесь в репозиторий → **Actions**
- [ ] Выберите "Deploy to GitHub Pages"
- [ ] Нажмите "Run workflow" → "Run workflow"
- [ ] Дождитесь завершения (2-3 минуты)

### 4. Проверка (1 минута)

- [ ] Откройте ваш сайт на GitHub Pages
- [ ] Откройте консоль браузера (F12)
- [ ] Убедитесь, что видите: `API Configuration: { hasProxy: true, ... }`
- [ ] Попробуйте выполнить расчет - CORS ошибка должна исчезнуть!

## 📁 Файлы с инструкциями

- `PROXY_SETUP_GUIDE.md` - Подробная пошаговая инструкция с описаниями
- `cloudflare-worker-proxy.js` - Готовый код для копирования в Cloudflare Worker
- `SECRET_SETUP.md` - Инструкция по правильной настройке секрета

## ❓ Частые ошибки

### Ошибка: Все еще вижу CORS ошибку

**Проверьте:**
1. Секрет называется `VITE_API_PROXY_URL` (или `VITE_API_URL`)
2. В секрете указан URL Worker + `/api/v1`, а не название переменной
3. Проект был пересобран после добавления секрета
4. В консоли браузера `hasProxy: true`

### Ошибка: Прокси не работает

**Проверьте:**
1. Worker сохранен и задеплоен в Cloudflare
2. URL Worker правильный
3. В коде Worker указан правильный `API_BASE_URL`: `https://constrtodo.ru:3005`

### Ошибка: Не знаю, что вставить в поле Secret

**Правильный формат:**
```
https://your-worker-name.your-subdomain.workers.dev/api/v1
```

Пример:
```
https://acoustic-api-proxy.username.workers.dev/api/v1
```

**Неправильно:**
- ❌ `VITE_API_PROXY_URL` (это название переменной, а не значение)
- ❌ `https://constrtodo.ru:3005/api/v1` (это URL API, а не прокси)

## 💡 Советы

- Cloudflare Workers бесплатно дает 100,000 запросов в день - этого более чем достаточно
- Вы можете переименовать Worker в Cloudflare Dashboard для более понятного имени
- После настройки прокси он будет работать автоматически для всех запросов











