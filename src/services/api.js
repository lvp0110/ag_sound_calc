/**
 * API сервис для получения данных о конструкциях
 */

const API_BASE_URL = import.meta.env.PROD 
  ? 'https://db.acoustic.ru:3005/api/v1' 
  : '/api/v1';

/**
 * Получает все конструкции изоляции из API
 * @returns {Promise<Array>} Массив конструкций с полями Code и Img
 */
export const getAllIsolationConstr = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/AllIsolationConstr`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    // Возвращаем массив данных из поля data
    if (result.code === 200 && result.data) {
      return result.data;
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching isolation constructions:', error);
    return [];
  }
};

/**
 * Формирует полный URL для изображения из API
 * @param {string} imageName - Имя файла изображения из API
 * @returns {string} Полный URL изображения
 */
const getImageUrl = (imageName) => {
  if (!imageName) return '';
  
  // Если это уже полный URL, возвращаем как есть
  if (imageName.startsWith('http://') || imageName.startsWith('https://')) {
    return imageName;
  }
  
  // Формируем URL для изображений из API
  // Изображения находятся по адресу /api/v1/constr/{imageName}
  const imagesBaseUrl = `${API_BASE_URL}/constr`;
  
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

