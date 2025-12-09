/**
 * УЛУЧШЕННАЯ ВЕРСИЯ CORS Proxy для API запросов к db.acoustic.ru:3005
 * 
 * ОСОБЕННОСТИ:
 * - Кэширование изображений на 7 дней
 * - Кэширование JSON данных на 1 час
 * - Оптимизация для работы без VPN
 * - Поддержка всех методов HTTP
 * 
 * ИНСТРУКЦИЯ:
 * 1. Скопируйте ВЕСЬ код ниже (начиная со следующей строки)
 * 2. Вставьте в редактор Cloudflare Worker
 * 3. Сохраните и задеплойте
 * 4. Установите переменную окружения API_BASE_URL в настройках Worker (опционально)
 */

export default {
  async fetch(request, env, ctx) {
    // Можно использовать переменную окружения или значение по умолчанию
    const API_BASE_URL = env.API_BASE_URL || 'https://db.acoustic.ru:3005';
    
    // CORS заголовки
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

    try {
      // Получаем путь запроса
      const url = new URL(request.url);
      const apiPath = url.pathname + url.search;
      const apiUrl = `${API_BASE_URL}${apiPath}`;

      // Определяем, является ли запрос запросом изображения
      const isImageRequest = /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(apiPath) || 
                             apiPath.includes('/constr/');

      // Для GET запросов проверяем кэш
      const cache = caches.default;
      if (request.method === 'GET') {
        // Создаем ключ для кэша из URL запроса
        const cacheKey = new Request(request.url, {
          method: 'GET',
          headers: request.headers,
        });
        
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
          // Возвращаем кэшированный ответ с CORS заголовками
          const headers = new Headers(cachedResponse.headers);
          Object.keys(corsHeaders).forEach(key => {
            headers.set(key, corsHeaders[key]);
          });
          headers.set('CF-Cache-Status', 'HIT');
          return new Response(cachedResponse.body, {
            status: cachedResponse.status,
            statusText: cachedResponse.statusText,
            headers: headers,
          });
        }
      }

      // Создаем заголовки для запроса к API
      const requestHeaders = new Headers();
      const contentType = request.headers.get('content-type');
      if (contentType) {
        requestHeaders.set('content-type', contentType);
      }
      const accept = request.headers.get('accept');
      if (accept) {
        requestHeaders.set('accept', accept);
      }

      // Выполняем запрос к API
      // Cloudflare Workers имеют встроенный таймаут: 30 секунд для free плана, 50 секунд для paid
      let response;
      try {
        response = await fetch(apiUrl, {
          method: request.method,
          headers: requestHeaders,
          body: request.body,
          // Увеличиваем таймаут через signal (если доступно)
          // Cloudflare Workers автоматически обрабатывают таймауты
        });
      } catch (fetchError) {
        // Обработка ошибок сети (таймауты, недоступность сервера и т.д.)
        console.error('[Worker] Fetch error:', fetchError.message, 'URL:', apiUrl);
        return new Response(
          JSON.stringify({ 
            error: fetchError.message || 'Network error',
            message: 'Не удалось подключиться к API серверу. Возможно, требуется VPN или сервер недоступен.',
            apiUrl: apiUrl,
            type: 'network_error'
          }), 
          {
            status: 504,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // Проверяем статус ответа
      if (!response.ok) {
        console.error('[Worker] API error:', response.status, 'URL:', apiUrl);
        return new Response(
          JSON.stringify({ 
            error: `API returned status ${response.status}`,
            message: 'API сервер вернул ошибку',
            status: response.status
          }), 
          {
            status: response.status,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // Получаем тело ответа
      const responseBody = await response.arrayBuffer();

      // Создаем новый ответ
      const newResponse = new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...corsHeaders,
          'Content-Type': response.headers.get('Content-Type') || 'application/json',
        },
      });

      // Кэшируем GET запросы
      if (request.method === 'GET' && response.status === 200) {
        // Для изображений кэшируем на 7 дней
        // Для остальных данных - на 1 час
        const cacheTime = isImageRequest ? 7 * 24 * 60 * 60 : 60 * 60;
        
        const cacheResponse = newResponse.clone();
        cacheResponse.headers.set('Cache-Control', `public, max-age=${cacheTime}`);
        cacheResponse.headers.set('CF-Cache-Status', 'MISS');
        
        // Создаем ключ для кэша из оригинального запроса
        const cacheKey = new Request(request.url, {
          method: 'GET',
          headers: request.headers,
        });
        
        // Кэшируем ответ асинхронно
        ctx.waitUntil(cache.put(cacheKey, cacheResponse));
      }

      return newResponse;
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          error: error.message,
          message: 'Ошибка при запросе к API серверу'
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
};







