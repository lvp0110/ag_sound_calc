/**
 * Конфигурация API
 */

// Базовый URL API
const API_BASE = 'https://constrtodo.ru:3005/api/v1';

/**
 * Получает URL для API запроса
 * @param {string} endpoint - Конечная точка API (например, '/AllIsolationConstr')
 * @returns {string} Полный URL для запроса
 */
export const getApiUrl = (endpoint) => {
  // В dev режиме используем прокси через Vite
  if (import.meta.env.DEV) {
    return `/api/v1${endpoint}`;
  }

  // В production используем прямой URL
  return `${API_BASE}${endpoint}`;
};

/**
 * Получает базовый URL для изображений
 */
export const getImagesBaseUrl = () => {
  if (import.meta.env.DEV) {
    return 'http://localhost:3005/api/v1/constr';
  }
  
  return 'https://constrtodo.ru:3005/api/v1/constr';
};
