/**
 * CORS Proxy для API запросов к constrtodo.ru:3005
 * 
 * ИНСТРУКЦИЯ ПО ИСПОЛЬЗОВАНИЮ:
 * 1. Зарегистрируйтесь на https://workers.cloudflare.com/
 * 2. Создайте новый Worker
 * 3. Скопируйте весь код ниже (начиная с const API_BASE_URL) и вставьте в редактор Worker
 * 4. Нажмите "Save and Deploy"
 * 5. Скопируйте URL вашего Worker (например: https://your-worker.workers.dev)
 * 6. Используйте этот URL в секрете GitHub: https://your-worker.workers.dev/api/v1
 */

const API_BASE_URL = 'https://constrtodo.ru:3005';

export default {
  async fetch(request, env, ctx) {
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
};


