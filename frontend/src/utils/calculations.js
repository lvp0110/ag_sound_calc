/**
 * Вычисляет площадь и периметр для конструкции
 */
export const calculateAreaAndPerimeter = (lenX, lenY, lenZ, currentSubCategory) => {
  let area = 0;
  let perimeter = 0;

  if (currentSubCategory == "F") {
    // Floor: Area = lenX * lenY (in mm²)
    area = Math.round(lenX * lenY);
    perimeter = Math.round(2 * (lenX + lenY)); // in mm
  } else if (currentSubCategory == "C") {
    // Ceiling: Area = lenX * lenY (in mm²)
    area = Math.round(lenX * lenY);
    perimeter = Math.round(2 * (lenX + lenY)); // in mm
  } else if (currentSubCategory == "W" || currentSubCategory == "L") {
    // Wall/Frame: Area = lenX * lenZ (in mm²)
    area = Math.round(lenX * lenZ);
    perimeter = Math.round(2 * (lenX + lenZ)); // in mm
  }

  return { area, perimeter };
};

/**
 * Получает код конструкции по материалам
 */
export const getConstructionCode = (currentConstr, currentGkla, currentWool) => {
  if (currentGkla == "default" && currentWool == "default") {
    return currentConstr;
  } else if (currentGkla == "default") {
    return currentConstr + "_" + currentWool;
  } else if (currentWool == "default") {
    return currentConstr + "_" + currentGkla;
  }
  return currentConstr + "_" + currentGkla + "_" + currentWool;
};

/**
 * Базовый шифр для колонки «шифр» в UI (AG.L401), если в расчёт ушёл вариант
 * с суффиксом материалов (AG.L401_2500P). Сопоставление — по каталогу AllIsolationConstr.
 */
export const resolveDisplayCipher = (calcCode, titleByCode) => {
  const code = String(calcCode ?? "").trim();
  if (!code) return "";
  if (!(titleByCode instanceof Map) || titleByCode.size === 0) {
    return code;
  }
  if (titleByCode.has(code)) return code;

  let best = "";
  for (const key of titleByCode.keys()) {
    const base = String(key ?? "").trim();
    if (!base) continue;
    if (code === base || code.startsWith(`${base}_`)) {
      if (base.length > best.length) best = base;
    }
  }
  return best || code;
};












