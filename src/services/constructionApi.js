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
    
    return "https://constrtodo.ru:3005/api/v1/calcIsolation/byProduct";
  };

  const apiUrl = getApiUrl();

  const startTime = performance.now();
  const payload = JSON.stringify(constrList);
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: payload,
    mode: "cors",
  });

  const fetchTime = performance.now() - startTime;

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
    console.error(
      "[API] calcIsolation 4xx/5xx",
      {
        url: apiUrl,
        status: response.status,
        statusText: response.statusText,
        elapsedMs: Math.round(fetchTime),
        requestBodyPreview: payload?.slice(0, 200),
      },
      "response:",
      errorText
    );

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
