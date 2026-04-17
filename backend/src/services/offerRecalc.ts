import {
  calculateByProduct,
  type CalcMaterial,
  type CalcParams,
} from "./calcService.js";

interface ConstructionRow {
  id: string;
  position: number;
  calcParams: unknown;
  materials: unknown;
}

interface RecalcResult {
  id: string;
  position: number;
  materials: CalcMaterial[];
}

const materialKey = (m: CalcMaterial): string => {
  const articul = m.articul ? String(m.articul).trim() : "";
  return articul || m.name;
};

/**
 * Накладывает сохранённые правки цен поверх свежего расчёта.
 *
 * Правило: если у сохранённой позиции (матчинг по articul, fallback — name)
 * цена отличается от свежей — считаем это пользовательским override и
 * возвращаем сохранённое значение цены. Остальные поля (count/name/unit)
 * всегда берутся из свежего расчёта.
 */
export const mergeMaterialOverrides = (
  fresh: CalcMaterial[],
  saved: CalcMaterial[] | null
): CalcMaterial[] => {
  if (!saved || saved.length === 0) return fresh;

  const savedByKey = new Map<string, CalcMaterial>();
  for (const m of saved) savedByKey.set(materialKey(m), m);

  return fresh.map((freshItem) => {
    const savedItem = savedByKey.get(materialKey(freshItem));
    if (!savedItem) return freshItem;

    const result: CalcMaterial = { ...freshItem };
    if (
      savedItem.pricePerUnit !== undefined &&
      savedItem.pricePerUnit !== freshItem.pricePerUnit
    ) {
      result.pricePerUnit = savedItem.pricePerUnit;
    }
    if (
      savedItem.pricePerSquareMeter !== undefined &&
      savedItem.pricePerSquareMeter !== freshItem.pricePerSquareMeter
    ) {
      result.pricePerSquareMeter = savedItem.pricePerSquareMeter;
    }
    return result;
  });
};

/**
 * Одним вызовом во внешний сервис получает свежие материалы для всех
 * конструкций оффера и накладывает пользовательские override по каждой.
 */
export const recalcConstructionsMaterials = async (
  constructions: ConstructionRow[]
): Promise<RecalcResult[]> => {
  if (constructions.length === 0) return [];

  const sorted = [...constructions].sort((a, b) => a.position - b.position);
  const params = sorted.map((c) => c.calcParams as CalcParams);
  const fresh = await calculateByProduct(params);

  return sorted.map((c, index) => ({
    id: c.id,
    position: c.position,
    materials: mergeMaterialOverrides(
      fresh[index] ?? [],
      (c.materials as CalcMaterial[] | null) ?? null
    ),
  }));
};
