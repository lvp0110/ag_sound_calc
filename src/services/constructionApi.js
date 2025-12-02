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
      // Убеждаемся, что URL заканчивается на /api/v1
      const base = proxyUrl.endsWith('/api/v1') ? proxyUrl : `${proxyUrl}/api/v1`;
      return `${base}/calcIsolation/byProduct`;
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
      const errorData = await response.json();
      errorText =
        errorData.error || errorData.message || JSON.stringify(errorData);
    } catch (e) {
      errorText = await response.text();
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

