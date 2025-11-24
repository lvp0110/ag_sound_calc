# Решение проблемы CORS

Если прокси не работает, есть несколько альтернативных решений:

## Вариант 1: Использовать CORS расширение для браузера

1. Установите расширение для браузера:
   - Chrome: "CORS Unblock" или "Allow CORS"
   - Firefox: "CORS Everywhere"

2. Включите расширение перед использованием приложения

## Вариант 2: Запустить Chrome с отключенной защитой CORS (только для разработки!)

```bash
# macOS
open -na Google\ Chrome --args --user-data-dir=/tmp/chrome_dev --disable-web-security --disable-features=VizDisplayCompositor

# Windows
chrome.exe --user-data-dir="C:/Chrome dev session" --disable-web-security

# Linux
google-chrome --user-data-dir="/tmp/chrome_dev" --disable-web-security
```

⚠️ **ВНИМАНИЕ**: Используйте только для разработки! Не используйте для обычного просмотра интернета!

## Вариант 3: Настроить прокси на уровне сервера

Если у вас есть доступ к серверу, можно настроить CORS заголовки на стороне API.

## Вариант 4: Использовать отдельный прокси-сервер

Можно использовать такие инструменты как:
- `cors-anywhere` (npm пакет)
- `http-proxy-middleware`

## Текущая конфигурация

В `vite.config.js` настроен прокси, который должен работать автоматически в dev режиме.

Если прокси не работает, проверьте:
1. Что dev сервер перезапущен после изменения `vite.config.js`
2. Что в консоли нет ошибок запуска Vite
3. Что URL запроса правильный (должен быть `/api/v1/...` в dev режиме)

