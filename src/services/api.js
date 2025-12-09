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
 * Кэш для отслеживания неудачных попыток загрузки через Worker
 */
const failedWorkerRequests = new Set();

/**
 * Формирует полный URL для изображения из API
 * @param {string} imageName - Имя файла изображения из API или путь вида /Img_constr/...
 * @param {boolean} useFallback - Использовать прямой URL (fallback) вместо прокси
 * @returns {string} Полный URL изображения
 */
export const getImageUrl = (imageName, useFallback = false) => {
  if (!imageName) return '';
  
  // Если это уже полный URL, возвращаем как есть
  if (imageName.startsWith('http://') || imageName.startsWith('https://')) {
    return imageName;
  }
  
  // Специальный случай: картинки потолков ЗИПС хранятся без папки zips_ceiling на API.
  // Если приходит путь zips_ceiling/filename.jpg — отправляем только filename.jpg.
  const zipsCeilingPrefix = 'zips_ceiling/';
  if (imageName.includes(zipsCeilingPrefix)) {
    const fileName = imageName.split(zipsCeilingPrefix).pop();
    if (fileName) {
      imageName = fileName;
    }
  }
  
  // Обрабатываем имя изображения
  let processedImageName = imageName;
  if (imageName.startsWith('/Img_constr/')) {
    const pathWithoutPrefix = imageName.replace('/Img_constr/', '');
    const parts = pathWithoutPrefix.split('/');
    if (parts.length >= 2) {
      const folder = parts[0];
      const fileName = parts[parts.length - 1];
      const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
      processedImageName = `${folder}_${fileNameWithoutExt}.jpg`;
    }
  } else if (imageName.startsWith('/')) {
    processedImageName = imageName.slice(1);
  }
  
  // Формируем URL для изображений из API
  // Изображения находятся по адресу /api/v1/constr/{imageName}
  if (import.meta.env.DEV) {
    return `http://localhost:3005/api/v1/constr/${processedImageName}`;
  }
  
  // В production используем прокси через Cloudflare Worker, если настроен и не используется fallback
  // Можно отключить Worker через VITE_DISABLE_WORKER=true
  if (!useFallback && import.meta.env.VITE_DISABLE_WORKER !== 'true') {
    const proxyUrl = import.meta.env.VITE_API_PROXY_URL || import.meta.env.VITE_API_URL;
    if (proxyUrl) {
      let normalizedUrl = proxyUrl.trim().replace(/\/+$/, '');
      
      if (normalizedUrl.includes('/apiv1')) {
        normalizedUrl = normalizedUrl.replace(/\/apiv1\/?$/, '/api/v1');
      }
      
      if (!normalizedUrl.endsWith('/api/v1')) {
        normalizedUrl = normalizedUrl.replace(/\/api\/v1\/?$/, '') + '/api/v1';
      }
      
      return `${normalizedUrl}/constr/${processedImageName}`;
    }
  }
  
  // Fallback на прямой URL (может быть заблокирован или CORS ошибка)
  return `https://db.acoustic.ru:3005/api/v1/constr/${processedImageName}`;
};

/**
 * Проверяет доступность изображения через Worker и возвращает URL с fallback
 * @param {string} imageName - Имя файла изображения
 * @returns {string} URL изображения с автоматическим fallback
 */
export const getImageUrlWithFallback = (imageName) => {
  if (!imageName) return '';
  
  // Проверяем, была ли предыдущая попытка загрузки через Worker неудачной
  const imageKey = imageName;
  if (failedWorkerRequests.has(imageKey)) {
    // Используем прямой URL как fallback
    return getImageUrl(imageName, true);
  }
  
  // Пытаемся использовать Worker
  return getImageUrl(imageName, false);
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
      imagesMap.set(item.Code, getImageUrlWithFallback(item.Img));
    }
  });
  
  return imagesMap;
};

/**
 * Предзагружает изображение с автоматическим fallback
 * @param {string} imageUrl - URL изображения для предзагрузки (через Worker)
 * @param {string} originalImageName - Оригинальное имя изображения для fallback
 * @returns {Promise<void>}
 */
export const preloadImage = (imageUrl, originalImageName = null) => {
  return new Promise((resolve) => {
    if (!imageUrl) {
      resolve();
      return;
    }
    
    const img = new Image();
    const startTime = Date.now();
    const TIMEOUT = 8000; // 8 секунд таймаут для изображений
    
    let timeoutId;
    let isResolved = false;
    
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      img.onload = null;
      img.onerror = null;
    };
    
    const handleSuccess = () => {
      if (isResolved) return;
      isResolved = true;
      cleanup();
      resolve();
    };
    
    const handleError = () => {
      if (isResolved) return;
      
      const loadTime = Date.now() - startTime;
      console.warn(`[API] Failed to preload image (${loadTime}ms):`, imageUrl);
      
      // Если это был Worker URL и есть оригинальное имя, пробуем fallback
      if (originalImageName && imageUrl.includes('.workers.dev')) {
        failedWorkerRequests.add(originalImageName);
        const fallbackUrl = getImageUrl(originalImageName, true);
        console.log('[API] Trying fallback URL:', fallbackUrl);
        
        // Пробуем загрузить через прямой URL
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          cleanup();
          resolve();
        };
        fallbackImg.onerror = () => {
          cleanup();
          resolve(); // Все равно резолвим, чтобы не блокировать
        };
        fallbackImg.src = fallbackUrl;
        return;
      }
      
      cleanup();
      resolve(); // Не отклоняем промис, чтобы не блокировать загрузку
    };
    
    img.onload = handleSuccess;
    img.onerror = handleError;
    
    // Таймаут для определения, что Worker не отвечает
    timeoutId = setTimeout(() => {
      if (!isResolved) {
        console.warn('[API] Image load timeout:', imageUrl);
        handleError();
      }
    }, TIMEOUT);
    
    img.src = imageUrl;
  });
};

/**
 * Предзагружает несколько изображений параллельно
 * @param {Array<{url: string, name: string}>|string[]} imageData - Массив URL изображений или объектов {url, name}
 * @param {number} batchSize - Количество параллельных загрузок (по умолчанию 3 для избежания перегрузки)
 * @returns {Promise<void>}
 */
export const preloadImages = async (imageData, batchSize = 3) => {
  if (!imageData || imageData.length === 0) return;
  
  // Преобразуем массив в формат {url, name}
  const images = imageData.map(item => {
    if (typeof item === 'string') {
      return { url: item, name: null };
    }
    return item;
  }).filter(item => item.url);
  
  if (images.length === 0) return;
  
  // Загружаем изображения батчами для избежания перегрузки
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize);
    await Promise.all(batch.map(({ url, name }) => preloadImage(url, name)));
  }
};

