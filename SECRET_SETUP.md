# Правильная настройка секрета в GitHub

## Ошибка в текущей настройке

В поле **Secret** (значение секрета) вы ввели название переменной `VITE_API_PROXY_URL`, но там должен быть **URL вашего прокси-сервера**.

## Правильная настройка

### Шаг 1: Создайте прокси-сервер (если еще не создан)

1. Зарегистрируйтесь на https://workers.cloudflare.com/
2. Создайте новый Worker
3. Используйте код из `docs/cors-proxy-example.md`
4. Получите URL вашего Worker (например: `https://my-proxy-123.workers.dev`)

### Шаг 2: Настройте секрет правильно

В GitHub:

**Name** (название секрета):
```
VITE_API_PROXY_URL
```

**Secret** (значение - это ваш URL прокси + путь):
```
https://my-proxy-123.workers.dev/api/v1
```

**ВАЖНО**: 
- В поле "Name" - название переменной: `VITE_API_PROXY_URL`
- В поле "Secret" - **реальный URL вашего прокси-сервера**, например: `https://your-proxy.workers.dev/api/v1`
- НЕ указывайте просто название переменной в поле "Secret"!

### Шаг 3: После настройки секрета

1. Удалите старый секрет (если он был неправильным)
2. Создайте новый секрет с правильным URL
3. Сделайте commit и push в ветку `main` (или запустите workflow вручную)

## Примеры правильных значений

### Если прокси на Cloudflare Workers:
```
https://your-proxy-name.workers.dev/api/v1
```

### Если прокси на другом сервисе:
```
https://your-domain.com/api/v1
```

## Проверка

После деплоя откройте консоль браузера на сайте GitHub Pages. Вы должны увидеть:

```
API Configuration: {
  hasProxy: true,
  proxyUrl: "https://your-proxy.workers.dev/api/v1",
  directApi: "https://db.acoustic.ru:3005/api/v1"
}
```

Если `hasProxy: false`, значит секрет не был правильно настроен или проект не был пересобран.


