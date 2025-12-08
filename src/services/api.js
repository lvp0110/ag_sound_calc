/**
 * API сервис для получения данных о конструкциях
 */

// Определяем базовый URL API с поддержкой прокси
const getApiBaseUrl = () => {
  // В dev режиме используем прокси через Vite
  if (import.meta.env.DEV) {
    return '/api/v1';
  }
  
  // В production проверяем наличие прокси из переменных окружения
  const proxyUrl = import.meta.env.VITE_API_PROXY_URL || import.meta.env.VITE_API_URL;
  if (proxyUrl) {
    // Нормализуем URL прокси
    let normalizedUrl = proxyUrl.trim().replace(/\/+$/, '');
    
    // Исправляем /apiv1 на /api/v1, если есть
    if (normalizedUrl.includes('/apiv1')) {
      normalizedUrl = normalizedUrl.replace(/\/apiv1\/?$/, '/api/v1');
    }
    
    // Убеждаемся, что URL заканчивается на /api/v1
    if (!normalizedUrl.endsWith('/api/v1')) {
      normalizedUrl = normalizedUrl.replace(/\/api\/v1\/?$/, '') + '/api/v1';
    }
    
    console.log('[API] Using proxy:', normalizedUrl);
    return normalizedUrl;
  }
  
  // Если прокси не настроен, используем прямой URL (может быть CORS ошибка)
  console.warn('[API] No proxy configured, using direct URL (CORS may fail)');
  return 'https://db.acoustic.ru:3005/api/v1';
};

const API_BASE_URL = getApiBaseUrl();

/**
 * Получает все конструкции изоляции из API
 * @returns {Promise<Array>} Массив конструкций с полями Code и Img
 */
export const getAllIsolationConstr = async () => {
  const url = `${API_BASE_URL}/AllIsolationConstr`;
  console.log('[API] Fetching:', url);
  
  try {
    const startTime = performance.now();
    
    // Создаем AbortController для таймаута
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд таймаут
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const fetchTime = performance.now() - startTime;
    console.log(`[API] Response received in ${fetchTime.toFixed(2)}ms, status:`, response.status);

    if (!response.ok) {
      console.error(`[API] HTTP error! status: ${response.status}, url: ${url}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    // Возвращаем массив данных из поля data
    if (result.code === 200 && result.data) {
      console.log(`[API] Successfully fetched ${result.data.length} constructions`);
      return result.data;
    }
    
    console.warn('[API] Unexpected response format:', result);
    return [];
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('[API] Request timeout:', url);
    } else {
      console.error('[API] Error fetching isolation constructions:', error, 'URL:', url);
    }
    return [];
  }
};

/**
 * Формирует полный URL для изображения из API
 * @param {string} imageName - Имя файла изображения из API или путь вида /Img_constr/...
 * @returns {string} Полный URL изображения
 */
export const getImageUrl = (imageName) => {
  if (!imageName) return '';
  
  // Если это уже полный URL, возвращаем как есть
  if (imageName.startsWith('http://') || imageName.startsWith('https://')) {
    return imageName;
  }
  
  // Формируем URL для изображений из API
  // Изображения находятся по адресу /api/v1/constr/{imageName}
  const getImagesBaseUrl = () => {
    if (import.meta.env.DEV) {
      return 'http://localhost:3005/api/v1/constr';
    }
    
    // В production используем прокси, если настроен
    const proxyUrl = import.meta.env.VITE_API_PROXY_URL || import.meta.env.VITE_API_URL;
    if (proxyUrl) {
      // Нормализуем URL прокси
      let normalizedUrl = proxyUrl.trim().replace(/\/+$/, '');
      
      // Исправляем /apiv1 на /api/v1, если есть
      if (normalizedUrl.includes('/apiv1')) {
        normalizedUrl = normalizedUrl.replace(/\/apiv1\/?$/, '/api/v1');
      }
      
      // Убеждаемся, что URL заканчивается на /api/v1
      if (!normalizedUrl.endsWith('/api/v1')) {
        normalizedUrl = normalizedUrl.replace(/\/api\/v1\/?$/, '') + '/api/v1';
      }
      
      return `${normalizedUrl}/constr`;
    }
    
    return 'https://db.acoustic.ru:3005/api/v1/constr';
  };
  
  const imagesBaseUrl = getImagesBaseUrl();
  
  // Обработка путей вида /Img_constr/floor/c2k2_1.png -> floor_c2k2_1.jpg
  if (imageName.startsWith('/Img_constr/')) {
    // Убираем префикс /Img_constr/
    const pathWithoutPrefix = imageName.replace('/Img_constr/', '');
    // Разбиваем путь на части: floor/c2k2_1.png
    const parts = pathWithoutPrefix.split('/');
    if (parts.length >= 2) {
      // Извлекаем папку (floor) и имя файла (c2k2_1.png)
      const folder = parts[0]; // floor
      const fileName = parts[parts.length - 1]; // c2k2_1.png
      // Убираем расширение и добавляем .jpg
      const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, ''); // c2k2_1
      // Формируем имя в формате API: floor_c2k2_1.jpg
      const apiImageName = `${folder}_${fileNameWithoutExt}.jpg`;
      return `${imagesBaseUrl}/${apiImageName}`;
    }
  }
  
  // Если имя файла начинается с /, убираем его
  const cleanImageName = imageName.startsWith('/') ? imageName.slice(1) : imageName;
  
  return `${imagesBaseUrl}/${cleanImageName}`;
};

/**
 * Создает мапу изображений по коду конструкции
 * @returns {Promise<Map<string, string>>} Мапа где ключ - Code, значение - Img (полный URL или путь)
 */
export const getImagesMap = async () => {
  const constructions = await getAllIsolationConstr();
  const imagesMap = new Map();
  
  constructions.forEach((item) => {
    if (item.Code && item.Img) {
      imagesMap.set(item.Code, getImageUrl(item.Img));
    }
  });
  
  return imagesMap;
};

