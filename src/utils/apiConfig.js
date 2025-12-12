/**
 * Конфигурация API и прокси для обхода CORS
 */

// Базовый URL API
const API_BASE = 'https://db.acoustic.ru:3005/api/v1';

// Прокси для обхода CORS (можно настроить свой прокси через Cloudflare Workers или другой сервис)
// Пример: 'https://your-proxy.workers.dev/api/v1'
// Для публичного прокси можно использовать CORS Anywhere (но не рекомендуется для production)
// Поддерживаем оба варианта названий для обратной совместимости
const PROXY_URL = import.meta.env.VITE_API_PROXY_URL || import.meta.env.VITE_API_URL || null;


/**
 * Получает URL для API запроса с учетом прокси
 * @param {string} endpoint - Конечная точка API (например, '/AllIsolationConstr')
 * @returns {string} Полный URL для запроса
 */
export const getApiUrl = (endpoint) => {
  // В dev режиме используем прокси через Vite
  if (import.meta.env.DEV) {
    return `/api/v1${endpoint}`;
  }

  // В production используем прокси если указан
  if (PROXY_URL) {
    const fullUrl = `${PROXY_URL}${endpoint}`;
    return fullUrl;
  }

  // Иначе прямой запрос к API (может быть заблокирован CORS)
  const directUrl = `${API_BASE}${endpoint}`;
  console.warn(`[API] No proxy configured, using direct URL: ${directUrl}`);
  console.warn(`[API] This may fail due to CORS. Configure VITE_API_PROXY_URL or VITE_API_URL secret.`);
  return directUrl;
};

/**
 * Выполняет fetch запрос с обработкой CORS ошибок
 * @param {string} url - URL для запроса
 * @param {RequestInit} options - Опции для fetch
 * @returns {Promise<Response>}
 */
export const fetchWithCorsHandling = async (url, options = {}) => {
  try {
    const response = await fetch(url, {
      ...options,
      mode: 'cors',
      credentials: 'omit',
    });
    return response;
  } catch (error) {
    // Если это CORS ошибка и прокси не используется, попробуем использовать публичный прокси
    if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
      console.warn('CORS error detected. Please configure VITE_API_PROXY_URL in your environment variables.');
      console.warn('You can set up a proxy using Cloudflare Workers or another service.');
      throw new Error(
        'CORS Error: API server does not allow requests from this origin. ' +
        'Please configure a proxy by setting VITE_API_PROXY_URL environment variable. ' +
        'See README.md for more information.'
      );
    }
    throw error;
  }
};

/**
 * Получает базовый URL для изображений
 */
export const getImagesBaseUrl = () => {
  if (import.meta.env.DEV) {
    return 'http://localhost:3005/api/v1/constr';
  }
  
  if (PROXY_URL) {
    // Если используется прокси, изображения тоже должны идти через него
    // PROXY_URL уже содержит /api/v1, поэтому просто добавляем /constr
    return `${PROXY_URL}/constr`;
  }
  
  return 'https://db.acoustic.ru:3005/api/v1/constr';
};

