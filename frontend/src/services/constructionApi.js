/**
 * API сервис для расчета конструкций
 */
export const calculateConstruction = async (constrList) => {
  if (!constrList || constrList.length === 0) {
    return { data: [] };
  }

  // Всегда относительный путь /api/v1/calcIsolation/byProduct:
  // - в dev Vite-proxy из vite.config.js переправит на dev3.constrtodo.ru:3005;
  // - в prod host nginx → frontend-container → backend (calc.ts proxy) → внешний сервис.
  // Cross-origin не нужен — запрос на том же origin, что и страница.
  const apiUrl = "/api/v1/calcIsolation/byProduct";

  const payload = JSON.stringify(constrList);
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: payload,
    credentials: "include",
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

/**
 * Минимальный объект расчёта для получения перечня материалов (как в калькуляторе, без ввода размеров пользователем).
 * Количества ориентировочные; названия и артикулы совпадают с расчётом.
 */
export const buildMinimalCalcPayloadForMaterialsList = (code) => {
  if (!code) return null;
  const payload = {
    Code: code,
    LenX: 3000,
    LenY: 3000,
    LenZ: 2700,
    AddCeilShift: 0,
    step: 600,
    dframe: false,
    Area: 9,
    Perimeter: 12,
    Openings: [],
  };
  if (code === "AG.L401" || code === "AG.W101" || code === "AG.W105") {
    payload.dframe = true;
  }
  if (code === "AG.F615" || code === "AG.F615_vibroflex_LD") {
    payload.step = 400;
  }
  return payload;
};

/**
 * Список материалов через POST /api/v1/calcIsolation/byProduct (когда v2/props недоступен или пустой).
 */
export const getMaterialsListViaCalc = async (code) => {
  const payload = buildMinimalCalcPayloadForMaterialsList(code);
  if (!payload) return null;
  try {
    const result = await calculateConstruction([payload]);
    const rows = result?.data;
    if (Array.isArray(rows) && rows.length > 0) return rows;
  } catch {
    // часть шифров или размеров может быть отклонена API
  }
  return null;
};
