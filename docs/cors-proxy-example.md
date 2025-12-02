# Настройка прокси для обхода CORS

Для решения проблемы CORS при публикации на GitHub Pages или другом домене, вам нужно настроить прокси-сервер.

## Вариант 1: Cloudflare Workers (рекомендуется)

1. Зарегистрируйтесь на [Cloudflare Workers](https://workers.cloudflare.com/)

2. Создайте новый Worker и добавьте следующий код:

```javascript
/**
 * CORS Proxy для API запросов
 * Замените API_BASE_URL на ваш реальный API URL
 */
const API_BASE_URL = 'https://db.acoustic.ru:3005';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Разрешаем CORS для всех доменов (или укажите конкретные)
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  // Обработка preflight запросов
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Получаем путь запроса
  const url = new URL(request.url);
  // Путь уже содержит /api/v1/..., поэтому просто добавляем к базовому URL
  const apiPath = url.pathname + url.search;

  // Формируем URL для API запроса
  // Если путь начинается с /api/v1, просто заменяем домен
  const apiUrl = `${API_BASE_URL}${apiPath}`;

  try {
    // Создаем заголовки для API запроса (убираем host и другие проблемные заголовки)
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete('host');
    requestHeaders.delete('cf-connecting-ip');
    requestHeaders.delete('cf-ray');
    
    // Создаем новый запрос к API
    const apiRequest = new Request(apiUrl, {
      method: request.method,
      headers: requestHeaders,
      body: request.body,
    });

    // Выполняем запрос к API
    const response = await fetch(apiRequest);

    // Получаем тело ответа
    const responseBody = await response.arrayBuffer();

    // Создаем новый ответ с CORS заголовками
    const newResponse = new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });

    return newResponse;
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
}
```

3. Сохраните Worker и получите его URL (например, `https://your-proxy.workers.dev`)

4. Установите переменную окружения при сборке:
   ```bash
   VITE_API_PROXY_URL=https://your-proxy.workers.dev/api/v1 npm run build
   ```

5. Или добавьте в GitHub Actions workflow:
   ```yaml
   - name: Build
     env:
       VITE_API_PROXY_URL: https://your-proxy.workers.dev/api/v1
     run: npm run build
   ```

## Вариант 2: Настройка CORS на API сервере

Если у вас есть доступ к API серверу (`https://db.acoustic.ru:3005`), можно настроить CORS там:

```javascript
// Пример для Express.js
app.use(cors({
  origin: [
    'https://your-username.github.io',
    'https://your-custom-domain.com',
  ],
  credentials: true,
}));
```

## Вариант 3: Использование других прокси-сервисов

Вы можете использовать другие сервисы для прокси:
- Vercel Serverless Functions
- AWS Lambda
- Google Cloud Functions
- Netlify Functions

Принцип тот же: прокси должен принимать запросы с вашего домена и перенаправлять их на API сервер с добавлением необходимых CORS заголовков.

