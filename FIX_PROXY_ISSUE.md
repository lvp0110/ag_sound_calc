# Решение проблемы с прокси

## Проблема

В консоли вы видите ошибку:
```
Failed to load resource: net::ERR_NAME_NOT_RESOLVED
my-proxy-123.workers.dev/api/v1/AllIsolationConstr
```

Это означает, что в секрете GitHub указан **пример URL** из документации (`my-proxy-123.workers.dev`), а не реальный прокси-сервер.

## Решение

У вас есть 2 варианта:

### Вариант 1: Создать реальный прокси (рекомендуется)

1. Следуйте инструкции в файле `QUICK_START.md` или `PROXY_SETUP_GUIDE.md`
2. Создайте реальный прокси через Cloudflare Workers
3. Получите реальный URL (например: `https://acoustic-api-proxy.username.workers.dev`)
4. Обновите секрет в GitHub:
   - Перейдите в **Settings** → **Secrets and variables** → **Actions**
   - Найдите секрет `VITE_API_PROXY_URL` (или `VITE_API_URL`)
   - Нажмите на карандаш (редактировать)
   - Замените `https://my-proxy-123.workers.dev/api/v1` на ваш реальный URL + `/api/v1`
   - Пример: `https://acoustic-api-proxy.username.workers.dev/api/v1`
5. Пересоберите проект

### Вариант 2: Удалить секрет (временно отключить прокси)

Если вы не хотите создавать прокси прямо сейчас:

1. Перейдите в **Settings** → **Secrets and variables** → **Actions**
2. Удалите секрет `VITE_API_PROXY_URL` (или `VITE_API_URL`)
3. Приложение будет пытаться обращаться к API напрямую (будет CORS ошибка, но приложение загрузится)

**Важно**: При этом варианте CORS ошибки останутся, и API запросы не будут работать.

## Проверка

После обновления секрета:
1. Сделайте commit и push, или запустите workflow вручную
2. Откройте консоль браузера на сайте
3. Проверьте логи:
   - Если прокси настроен правильно: `API Configuration: { hasProxy: true, proxyUrl: "https://..." }`
   - Если прокси не настроен: `API Configuration: { hasProxy: false, proxyUrl: "not configured" }`

## Что делать прямо сейчас?

1. **Если нужно, чтобы приложение работало СЕЙЧАС**:
   - Создайте прокси через Cloudflare Workers (5 минут)
   - Обновите секрет

2. **Если нет времени на создание прокси**:
   - Удалите секрет (приложение загрузится, но API не будет работать)
   - Создайте прокси позже

## Где найти инструкции?

- `QUICK_START.md` - быстрый старт (5 минут)
- `PROXY_SETUP_GUIDE.md` - подробная инструкция
- `cloudflare-worker-proxy.js` - готовый код для прокси

