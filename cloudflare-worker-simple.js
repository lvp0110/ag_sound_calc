/**
 * ПРОСТАЯ ВЕРСИЯ CORS Proxy для API запросов к db.acoustic.ru:3005
 * 
 * ИНСТРУКЦИЯ:
 * 1. Скопируйте ВЕСЬ код ниже (начиная со следующей строки)
 * 2. Вставьте в редактор Cloudflare Worker
 * 3. Сохраните и задеплойте
 */

export default {
  async fetch(request) {
    const API_BASE_URL = 'https://db.acoustic.ru:3005';
    
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
      const response = await fetch(apiUrl, {
        method: request.method,
        headers: requestHeaders,
        body: request.body,
      });

      // Получаем тело ответа
      const responseBody = await response.arrayBuffer();

      // Возвращаем ответ с CORS заголовками
      return new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...corsHeaders,
          'Content-Type': response.headers.get('Content-Type') || 'application/json',
        },
      });
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





