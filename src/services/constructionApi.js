/**
 * API сервис для расчета конструкций
 */
export const calculateConstruction = async (constrList) => {
  if (!constrList || constrList.length === 0) {
    console.warn("Empty construction list");
    return { data: [] };
  }

  const apiUrl = import.meta.env.DEV
    ? "/api/v1/calcIsolation/byProduct"
    : "https://db.acoustic.ru:3005/api/v1/calcIsolation/byProduct";

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

