/**
 * Конвертирует единицы измерения материала
 */
export const convertUnits = (material) => {
  if (material.Units == "м2") {
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





