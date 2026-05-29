import { env } from "../config/env.js";
import {
  isUlTapeCalcCode,
  isUltracousticFloorSealant,
  mapVibrosilSealantToUltracoustic,
  mapVibrostekMaterialsToUlTape,
  vibrostekCodeFromUlTape,
} from "./calcUlTapeFallback.js";
import {
  getCachedCalcMaterials,
  setCachedCalcMaterials,
} from "./calcResultCache.js";

export interface CalcParams {
  Code: string;
  LenX: number;
  LenY: number;
  LenZ: number;
  AddCeilShift: number;
  step: number;
  dframe: boolean;
  Area: number;
  Perimeter: number;
  Openings: Array<{ lenX: number; lenZ: number; Type: string }>;
}

export interface CalcMaterial {
  articul?: string;
  name: string;
  count: number;
  unit: string;
  pricePerSquareMeter?: number;
  pricePerUnit?: number;
}

export class CalcServiceError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "CalcServiceError";
  }
}

const CALC_PATH = "/api/v1/calcIsolation/byProduct";

const fetchMaterialsFromCalcService = async (
  params: CalcParams
): Promise<CalcMaterial[]> => {
  const url = `${env.calcServiceUrl.replace(/\/$/, "")}${CALC_PATH}`;

  let response: globalThis.Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify([params]),
      signal: AbortSignal.timeout(env.calcServiceTimeoutMs),
    });
  } catch (err) {
    const message =
      err instanceof Error && err.name === "TimeoutError"
        ? `Calc service timeout after ${env.calcServiceTimeoutMs}ms`
        : `Calc service request failed: ${err instanceof Error ? err.message : String(err)}`;
    throw new CalcServiceError(message);
  }

  if (!response.ok) {
    let detail = "";
    try {
      detail = await response.text();
    } catch {
      // ignore
    }
    throw new CalcServiceError(
      `Calc service responded with ${response.status}${detail ? `: ${detail}` : ""}`,
      response.status
    );
  }

  const payload: unknown = await response.json();
  const raw =
    payload && typeof payload === "object" && "data" in payload
      ? (payload as { data: unknown }).data
      : payload;
  return Array.isArray(raw) ? (raw as CalcMaterial[]) : [];
};

/**
 * Вызывает внешний сервис расчёта для ОДНОЙ конструкции.
 * Возвращает плоский массив материалов этой конструкции.
 */
const calculateOne = async (params: CalcParams): Promise<CalcMaterial[]> => {
  const cached = getCachedCalcMaterials(params);
  if (cached) return cached;

  let materials = await fetchMaterialsFromCalcService(params);

  // Внешний calc пока не знает *_ul_tape — считаем через *_vibrostek и подменяем ленту.
  if (materials.length === 0 && isUlTapeCalcCode(params.Code)) {
    const vibrostekParams = {
      ...params,
      Code: vibrostekCodeFromUlTape(params.Code),
    };
    const vibrostekMaterials = await fetchMaterialsFromCalcService(vibrostekParams);
    const mapped = mapVibrostekMaterialsToUlTape(vibrostekMaterials);
    if (mapped) materials = mapped as CalcMaterial[];
  }

  const floorSealant = (params as unknown as Record<string, unknown>).FloorSealant;
  if (isUltracousticFloorSealant(floorSealant)) {
    const sealantMapped = mapVibrosilSealantToUltracoustic(materials);
    if (sealantMapped) materials = sealantMapped as CalcMaterial[];
  }

  setCachedCalcMaterials(params, materials);
  return materials;
};

/**
 * Расчёт материалов для нескольких конструкций.
 *
 * Внешний сервис при получении массива из нескольких конструкций возвращает
 * плоский список материалов, потеряв разбивку по конструкциям. Поэтому вызываем
 * его отдельно на каждую конструкцию (так же делает фронтовый Calculator,
 * см. `src/services/constructionApi.js:calculateConstruction([one])`).
 *
 * Возвращает `Material[][]`: индекс i — материалы конструкции i.
 */
export const calculateByProduct = async (
  calcParams: CalcParams[]
): Promise<CalcMaterial[][]> => {
  if (!calcParams || calcParams.length === 0) return [];
  return Promise.all(calcParams.map((p) => calculateOne(p)));
};
