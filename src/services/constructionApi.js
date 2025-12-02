/**
 * API сервис для расчета конструкций
 */
export const calculateConstruction = async (constrList) => {
  if (!constrList || constrList.length === 0) {
    console.warn("Empty construction list");
    return { data: [] };
  }

  // Определяем URL для расчета конструкций
  const getApiUrl = () => {
    if (import.meta.env.DEV) {
      return "/api/v1/calcIsolation/byProduct";
    }
    
    // В production проверяем наличие прокси
    const proxyUrl = import.meta.env.VITE_API_PROXY_URL || import.meta.env.VITE_API_URL;
    if (proxyUrl) {
      // Нормализуем URL прокси: убираем лишние слеши и убеждаемся, что заканчивается на /api/v1
      let normalizedUrl = proxyUrl.trim();
      // Убираем слеш в конце, если есть
      normalizedUrl = normalizedUrl.replace(/\/+$/, '');
      
      // Если URL уже содержит /api/v1, используем как есть
      if (normalizedUrl.endsWith('/api/v1')) {
        return `${normalizedUrl}/calcIsolation/byProduct`;
      }
      
      // Если URL содержит /apiv1 (без слешей), исправляем
      if (normalizedUrl.includes('/apiv1')) {
        normalizedUrl = normalizedUrl.replace(/\/apiv1\/?$/, '/api/v1');
        return `${normalizedUrl}/calcIsolation/byProduct`;
      }
      
      // Если URL не содержит /api/v1, добавляем
      return `${normalizedUrl}/api/v1/calcIsolation/byProduct`;
    }
    
    // Если прокси не настроен, используем прямой URL (может быть CORS ошибка)
    return "https://db.acoustic.ru:3005/api/v1/calcIsolation/byProduct";
  };

  const apiUrl = getApiUrl();

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(constrList),
    mode: "cors",
  });

  if (!response.ok) {
    let errorText = "";
    try {
      // Клонируем response перед чтением, чтобы можно было прочитать несколько раз
      const clonedResponse = response.clone();
      const errorData = await clonedResponse.json();
      errorText =
        errorData.error || errorData.message || JSON.stringify(errorData);
    } catch (e) {
      // Если не удалось распарсить JSON, читаем как текст
      try {
        const clonedResponse = response.clone();
        errorText = await clonedResponse.text();
      } catch (textError) {
        errorText = `HTTP ${response.status}: ${response.statusText}`;
      }
    }
    console.error("API error response:", errorText);

    let errorMessage = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error || errorJson.message || errorText;
    } catch (e) {
      // Если не JSON, используем как есть
    }

    throw new Error(
      `HTTP error! status: ${response.status}, message: ${errorMessage}`
    );
  }

  const data = await response.json();

  if (data && data.data) {
    return data;
  } else if (Array.isArray(data)) {
    return { data: data };
  } else {
    console.warn("Unexpected response format:", data);
    return { data: [] };
  }
};

