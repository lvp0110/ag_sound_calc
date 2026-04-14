/** Ключ sessionStorage для состояния калькулятора (таблицы КП читают оттуда же). */
export const CALCULATOR_STATE_STORAGE_KEY = "calculator_state";

/**
 * Материалы по конструкциям из сохранённого состояния (или миграция со старого { data }).
 */
export function migrateMaterialsFromSavedState(saved) {
  if (!saved) return [];
  if (
    Array.isArray(saved.materialsByConstruction) &&
    saved.materialsByConstruction.length > 0
  ) {
    return saved.materialsByConstruction;
  }
  const old = saved.calculatedMaterials?.data;
  const constrs = saved.ConstrToCalc;
  if (
    Array.isArray(old) &&
    old.length > 0 &&
    Array.isArray(constrs) &&
    constrs.length === 1
  ) {
    return [{ key_id: constrs[0].key_id, data: old }];
  }
  return [];
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/** Дополнительные материалы для таблицы КП (мягкая миграция/валидация формата). */
export function migrateAdditionalMaterialsFromSavedState(saved) {
  if (!Array.isArray(saved?.additionalMaterials)) return [];

  return saved.additionalMaterials
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: isNonEmptyString(row.id)
        ? row.id
        : typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `mat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: isNonEmptyString(row.name) ? row.name : "",
      price: isNonEmptyString(row.price) ? row.price : "",
      quantity: isNonEmptyString(row.quantity) ? row.quantity : "",
      unit: isNonEmptyString(row.unit) ? row.unit : "",
    }));
}
