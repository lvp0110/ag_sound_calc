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

/** Извлекает ключ для матчинга по материалам. Покрывает оба контракта:
 *  внешний сервис (PascalCase: `Code`/`Name`) и тип из `types.ts` (lowercase: `articul`/`name`). */
type MaterialLike = Record<string, unknown>;
const materialKey = (m: MaterialLike): string => {
  const pick = (k: string) => {
    const v = m[k];
    return typeof v === "string" || typeof v === "number" ? String(v).trim() : "";
  };
  return pick("Code") || pick("articul") || pick("Name") || pick("name");
};

/**
 * Поля, которые считаем пользовательскими правками цен. Покрываем оба формата:
 * `KpPricePerM2`/`KpPricePerUnit` — как их пишет фронт (KpPage);
 * `pricePerSquareMeter`/`pricePerUnit` — legacy-имена из types.ts.
 */
const OVERRIDE_FIELDS = [
  "KpPricePerM2",
  "KpPricePerUnit",
  "pricePerSquareMeter",
  "pricePerUnit",
] as const;

/**
 * Накладывает сохранённые правки цен поверх свежего расчёта.
 *
 * Правило: для каждой свежей позиции ищем сохранённую по ключу (Code → articul →
 * Name → name). Если нашли — копируем все известные "override"-поля цен из
 * сохранённой. Остальные поля всегда берутся из свежего расчёта.
 */
export const mergeMaterialOverrides = (
  fresh: CalcMaterial[],
  saved: CalcMaterial[] | null
): CalcMaterial[] => {
  if (!saved || saved.length === 0) return fresh;

  const savedByKey = new Map<string, MaterialLike>();
  for (const m of saved) {
    const key = materialKey(m as unknown as MaterialLike);
    if (key) savedByKey.set(key, m as unknown as MaterialLike);
  }

  return fresh.map((freshItem) => {
    const savedItem = savedByKey.get(materialKey(freshItem as unknown as MaterialLike));
    if (!savedItem) return freshItem;

    const result = { ...(freshItem as unknown as MaterialLike) };
    for (const field of OVERRIDE_FIELDS) {
      const v = savedItem[field];
      if (v !== undefined && v !== null && v !== "") {
        result[field] = v;
      }
    }
    return result as unknown as CalcMaterial;
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
