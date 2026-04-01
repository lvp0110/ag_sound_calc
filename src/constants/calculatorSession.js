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
