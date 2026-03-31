/** Площадь: «м2» или «м²» (в т.ч. из API). */
export const isM2Units = (units) => {
  if (units == null) return false;
  const u = String(units).trim();
  return u === "м2" || u === "м²";
};

/**
 * Конвертирует единицы измерения материала
 */
export const convertUnits = (material) => {
  if (isM2Units(material.Units)) {
    const quantityInM2 = material.Quantity / 1e6;
    return quantityInM2.toFixed(2);
  }
  return material.Quantity;
};

/**
 * Фильтрует переменную (возвращает значение или "---")
 */
export const filterVariable = (variable) => {
  if (/^\d/.test(variable)) {
    return variable;
  } else {
    return "---";
  }
};

/**
 * Получает тип проема в текстовом виде
 */
export const getOpeningType = (Type) => {
  if (Type == "OST_Doors") return "дверь";
  return "окно";
};












