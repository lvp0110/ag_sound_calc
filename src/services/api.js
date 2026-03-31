/**
 * API сервис для получения данных о конструкциях
 */

// Определяем базовый URL API
const getApiBaseUrl = () => {
  // В dev режиме используем прокси через Vite
  if (import.meta.env.DEV) {
    return '/api/v1';
  }
  
  // В production используем прямой URL
  return 'https://constrtodo.ru:3005/api/v1';
};

const API_BASE_URL = getApiBaseUrl();

/**
 * Получает все конструкции изоляции из API
 * @returns {Promise<Array>} Массив конструкций с полями Code и Img
 */
export const getAllIsolationConstr = async () => {
  const url = `${API_BASE_URL}/AllIsolationConstr`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.code === 200 && result.data) {
      return result.data;
    }
    
    return [];
  } catch (error) {
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
  
  // Нормализуем полный URL от API до имени файла, чтобы можно было подменять на zipsCeilingApiImages.
  const devBase = 'http://localhost:3005/api/v1/constr/';
  const prodBase = 'https://constrtodo.ru:3005/api/v1/constr/';
  if (imageName.startsWith(devBase)) {
    imageName = imageName.slice(devBase.length);
  } else if (imageName.startsWith(prodBase)) {
    imageName = imageName.slice(prodBase.length);
  } else if (imageName.startsWith('http://') || imageName.startsWith('https://')) {
    // Для сторонних абсолютных ссылок возвращаем как есть
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
  
  return `https://constrtodo.ru:3005/api/v1/constr/${processedImageName}`;
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

/**
 * Предзагружает изображение
 * @param {string} imageUrl - URL изображения для предзагрузки
 * @returns {Promise<void>}
 */
export const preloadImage = (imageUrl) => {
  return new Promise((resolve) => {
    if (!imageUrl) {
      resolve();
      return;
    }
    
    const img = new Image();
    let isResolved = false;
    
    const handleSuccess = () => {
      if (isResolved) return;
      isResolved = true;
      img.onload = null;
      img.onerror = null;
      resolve();
    };
    
    const handleError = () => {
      if (isResolved) return;
      isResolved = true;
      img.onload = null;
      img.onerror = null;
      resolve();
    };
    
    img.onload = handleSuccess;
    img.onerror = handleError;
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
    await Promise.all(batch.map(({ url }) => preloadImage(url)));
  }
};

/**
 * Получает данные конкретной конструкции по коду
 * @param {string} code - Код конструкции (например, "AG.W101")
 * @returns {Promise<Object|null>} Объект с данными конструкции или null, если не найдена
 */
export const getConstructionByCode = async (code) => {
  if (!code) return null;
  
  try {
    const constructions = await getAllIsolationConstr();
    const construction = constructions.find(item => item.Code === code);
    
    if (construction) {
      // Обрабатываем изображения
      if (construction.Img) {
        construction.Img = getImageUrl(construction.Img);
      }
      if (construction.CadImg) {
        construction.CadImg = getImageUrl(construction.CadImg);
      }
    }
    
    return construction || null;
  } catch (error) {
    return null;
  }
};

/**
 * Достаёт плоский список материалов из ответа getConstructionProps (разные форматы бэкенда).
 * @param {Object|null} props
 * @returns {Array|null}
 */
export const extractMaterialsFromProps = (props) => {
  if (!props?.constr_materials) return null;
  const cm = props.constr_materials;
  if (!Array.isArray(cm) || cm.length === 0) return null;

  const materialsBlock = cm.find(
    (item) =>
      item &&
      typeof item === "object" &&
      (item.type === "Materials" || item.Type === "Materials")
  );
  if (materialsBlock) {
    const nested =
      materialsBlock.constr_materials ||
      materialsBlock.ConstrMaterials ||
      materialsBlock.materials;
    if (Array.isArray(nested) && nested.length > 0) return nested;
  }

  const first = cm[0];
  if (
    first &&
    (first.name != null ||
      first.Name != null ||
      first.code != null ||
      first.Code != null)
  ) {
    return cm;
  }
  return null;
};

/**
 * Получает свойства (материалы) конструкции по коду
 * @param {string} code - Код конструкции (например, "AG.W101")
 * @returns {Promise<Object|null>} Объект с данными свойств конструкции или null, если не найдена
 */
export const getConstructionProps = async (code) => {
  if (!code) return null;
  
  // Определяем базовый URL для v2 API
  const getApiV2BaseUrl = () => {
    if (import.meta.env.DEV) {
      return '/api/v2';
    }
    
    return 'https://constrtodo.ru:3005/api/v2';
  };
  
  const API_V2_BASE_URL = getApiV2BaseUrl();
  // Используем путь вместо query параметра: /props/AG.W101
  // Убеждаемся, что код правильно закодирован
  const encodedCode = encodeURIComponent(code);
  const url = `${API_V2_BASE_URL}/isolationConstructions/props/${encodedCode}`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // Для 404 ошибок - это нормально, данные могут отсутствовать
      if (response.status === 404) {
        // Тихо возвращаем null, не логируем ошибку
        return null;
      }
      
      return null;
    }
    
    const result = await response.json();
    
    // Если result - это массив (прямой ответ с материалами)
    if (Array.isArray(result)) {
      return { constr_materials: result };
    }
    
    // Возвращаем данные из поля data, если есть
    if (result.code === 200 && result.data) {
      // Проверяем, есть ли constr_materials в data
      if (result.data.constr_materials) {
        return result.data;
      }
      // Если data - это массив
      if (Array.isArray(result.data)) {
        return { constr_materials: result.data };
      }
      // Если constr_materials в корне data, возвращаем data
      return result.data;
    }
    
    // Если структура другая, проверяем корневой уровень
    if (result.constr_materials) {
      return result;
    }
    
    // Если data содержит constr_materials напрямую
    if (result.data && result.data.constr_materials) {
      return result.data;
    }
    
    // Если result.data - это массив
    if (result.data && Array.isArray(result.data)) {
      return { constr_materials: result.data };
    }
    
    // Если весь result - это объект с материалами (может быть прямая структура)
    if (result && typeof result === 'object' && !result.code && !result.data) {
      return result;
    }
    
    return null;
  } catch (error) {
    return null;
  }
};
