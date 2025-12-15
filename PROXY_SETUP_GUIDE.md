# Пошаговая инструкция: Создание прокси-сервера через Cloudflare Workers

Это подробная инструкция по созданию бесплатного прокси-сервера для обхода CORS ошибок.

## Шаг 1: Регистрация на Cloudflare

1. Перейдите на сайт: https://workers.cloudflare.com/
2. Нажмите кнопку **"Sign Up"** или **"Log In"** если уже зарегистрированы
3. Зарегистрируйтесь (можно через Google/GitHub) - это бесплатно
4. После регистрации вы попадете в Dashboard

## Шаг 2: Создание нового Worker

1. В Dashboard нажмите кнопку **"Create a Worker"** или **"Create Worker"**
2. Вас перенаправит в редактор кода

## Шаг 3: Настройка Worker

1. В левой панели вы увидите поле для ввода кода
2. Удалите весь существующий код
3. Скопируйте и вставьте следующий код:

```javascript
/**
 * CORS Proxy для API запросов к constrtodo.ru:3005
 */
const API_BASE_URL = 'https://constrtodo.ru:3005';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // CORS заголовки - разрешаем запросы со всех доменов
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  // Обработка preflight запросов (OPTIONS)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Получаем путь и параметры запроса
  const url = new URL(request.url);
  const apiPath = url.pathname + url.search;

  // Формируем полный URL для запроса к API
  const apiUrl = `${API_BASE_URL}${apiPath}`;

  try {
    // Создаем заголовки для запроса к API
    // Удаляем проблемные заголовки, которые не должны передаваться
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete('host');
    requestHeaders.delete('cf-connecting-ip');
    requestHeaders.delete('cf-ray');
    requestHeaders.delete('cf-visitor');
    
    // Сохраняем важные заголовки
    const contentType = request.headers.get('content-type');
    if (contentType) {
      requestHeaders.set('content-type', contentType);
    }
    
    const accept = request.headers.get('accept');
    if (accept) {
      requestHeaders.set('accept', accept);
    }

    // Создаем запрос к API серверу
    const apiRequest = new Request(apiUrl, {
      method: request.method,
      headers: requestHeaders,
      body: request.body,
    });

    // Выполняем запрос к API
    const response = await fetch(apiRequest);

    // Получаем тело ответа
    const responseBody = await response.arrayBuffer();

    // Создаем ответ с CORS заголовками
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
    return new Response(
      JSON.stringify({ 
        error: error.message,
        message: 'Произошла ошибка при запросе к API серверу'
      }), 
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
```

## Шаг 4: Сохранение и публикация Worker

1. После вставки кода нажмите кнопку **"Save and Deploy"** (обычно в правом верхнем углу)
2. Дождитесь завершения деплоя (обычно несколько секунд)
3. Вы увидите сообщение об успешном деплое

## Шаг 5: Получение URL вашего Worker

1. После деплоя в верхней части экрана вы увидите URL вашего Worker
2. URL будет выглядеть примерно так: `https://your-worker-name.your-subdomain.workers.dev`
3. **ВАЖНО**: Запишите этот URL! Он понадобится для настройки секрета

## Шаг 6: Настройка секрета в GitHub

1. Откройте ваш репозиторий на GitHub
2. Перейдите в **Settings** → **Secrets and variables** → **Actions**
3. Нажмите **"New repository secret"**
4. Заполните форму:
   - **Name**: `VITE_API_PROXY_URL`
   - **Secret**: `https://your-worker-name.your-subdomain.workers.dev/api/v1`
     - Замените `your-worker-name.your-subdomain.workers.dev` на ваш реальный URL Worker
     - Добавьте в конце `/api/v1`
5. Нажмите **"Add secret"**

## Шаг 7: Пересборка проекта

1. Вернитесь в ваш репозиторий на GitHub
2. Перейдите в **Actions**
3. Выберите workflow "Deploy to GitHub Pages"
4. Нажмите **"Run workflow"** → **"Run workflow"** (выберите ветку main)
5. Или просто сделайте любой commit и push в ветку `main`

## Шаг 8: Проверка работы

1. Дождитесь завершения деплоя (обычно 2-3 минуты)
2. Откройте ваш сайт на GitHub Pages
3. Откройте консоль браузера (F12 → Console)
4. Вы должны увидеть:
   ```
   API Configuration: {
     hasProxy: true,
    proxyUrl: "https://your-worker-name.your-subdomain.workers.dev/api/v1",
    directApi: "https://constrtodo.ru:3005/api/v1"
   }
   ```
5. Попробуйте выполнить расчет конструкции - CORS ошибка должна исчезнуть!

## Устранение проблем

### Проблема: Worker не работает
- Проверьте, что код скопирован полностью
- Убедитесь, что Worker сохранен и задеплоен
- Проверьте логи Worker в Dashboard Cloudflare

### Проблема: Все еще вижу CORS ошибку
- Проверьте, что секрет в GitHub называется `VITE_API_PROXY_URL`
- Проверьте, что значение секрета - это URL Worker + `/api/v1`
- Убедитесь, что проект был пересобран после добавления секрета
- Проверьте консоль браузера - там должно быть `hasProxy: true`

### Проблема: Ошибка 500 от прокси
 - Проверьте, что API_BASE_URL в коде Worker правильный: `https://constrtodo.ru:3005`
- Проверьте логи Worker в Cloudflare Dashboard

## Альтернатива: Тестирование прокси локально

Вы можете протестировать прокси сразу после создания:

1. Откройте ваш Worker URL в браузере
2. Добавьте путь, например: `https://your-worker.workers.dev/api/v1/AllIsolationConstr`
3. Вы должны увидеть ответ от API (или ошибку, если путь неправильный)

## Дополнительная информация

- Cloudflare Workers бесплатный план включает 100,000 запросов в день
- Если нужно ограничить доступ к прокси, можно указать конкретные домены в `Access-Control-Allow-Origin`
- Worker автоматически масштабируется под нагрузку

## Готово!

После выполнения всех шагов ваш прокси должен работать, и CORS ошибки исчезнут. Если возникнут проблемы - проверьте раздел "Устранение проблем" выше.











