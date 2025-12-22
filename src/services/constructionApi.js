/**
 * API сервис для расчета конструкций
 */
export const calculateConstruction = async (constrList) => {
  if (!constrList || constrList.length === 0) {
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

  if (!response.ok) {
    let errorText = "";
    try {
      const clonedResponse = response.clone();
      const errorData = await clonedResponse.json();
      errorText =
        errorData.error || errorData.message || JSON.stringify(errorData);
    } catch (e) {
      try {
        const clonedResponse = response.clone();
        errorText = await clonedResponse.text();
      } catch (textError) {
        errorText = `HTTP ${response.status}: ${response.statusText}`;
      }
    }

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
    return { data: [] };
  }
};
