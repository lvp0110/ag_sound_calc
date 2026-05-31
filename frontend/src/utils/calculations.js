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

import {
  HANGER_ULTRACOUSTIC,
  hasGklaChoice,
  hasHangerChoice,
  stripHangerSuffix,
  stripTapeSuffix,
  UL_HANGER_SUFFIX,
} from "./calcUlTapeFallback.js";

/**
 * Получает код конструкции по материалам
 */
export const getConstructionCode = (
  currentConstr,
  currentGkla,
  currentWool,
  currentHangerType
) => {
  const { base: baseWithHanger, tape } = stripTapeSuffix(currentConstr);
  const { base } = stripHangerSuffix(baseWithHanger);
  const gkla = hasGklaChoice(base) ? currentGkla : "default";
  let code = base;
  if (gkla == "default" && currentWool == "default") {
    code = base;
  } else if (gkla == "default") {
    code = `${base}_${currentWool}`;
  } else if (currentWool == "default") {
    code = `${base}_${gkla}`;
  } else {
    code = `${base}_${gkla}_${currentWool}`;
  }
  code += tape;
  if (
    hasHangerChoice(base) &&
    currentHangerType === HANGER_ULTRACOUSTIC
  ) {
    code += UL_HANGER_SUFFIX;
  }
  return code;
};

/**
 * Базовый шифр для колонки «шифр» в UI (AG.L401), если в расчёт ушёл вариант
 * с суффиксом материалов (AG.L401_2500P). Сопоставление — по каталогу AllIsolationConstr.
 */
export const resolveDisplayCipher = (calcCode, titleByCode) => {
  const code = String(calcCode ?? "").trim();
  if (!code) return "";
  const codeWithoutSuffix = code.split("_")[0] || code;
  if (!(titleByCode instanceof Map) || titleByCode.size === 0) {
    return codeWithoutSuffix;
  }
  if (titleByCode.has(code)) return code;
  if (titleByCode.has(codeWithoutSuffix)) return codeWithoutSuffix;

  let best = "";
  for (const key of titleByCode.keys()) {
    const base = String(key ?? "").trim();
    if (!base) continue;
    if (code === base || code.startsWith(`${base}_`)) {
      if (base.length > best.length) best = base;
    }
  }
  return best || codeWithoutSuffix;
};












