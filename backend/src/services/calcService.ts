import { env } from "../config/env.js";

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

/**
 * Вызывает внешний сервис расчёта материалов.
 *
 * Контракт совпадает с вызовом из фронта (см. src/services/constructionApi.js):
 * POST {CALC_SERVICE_URL}/api/v1/calcIsolation/byProduct с телом — массивом CalcParams.
 *
 * Ответ нормализуется к форме `Material[][]`: индекс i — материалы конструкции i.
 */
export const calculateByProduct = async (
  calcParams: CalcParams[]
): Promise<CalcMaterial[][]> => {
  if (!calcParams || calcParams.length === 0) {
    return [];
  }

  const url = `${env.calcServiceUrl.replace(/\/$/, "")}${CALC_PATH}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(calcParams),
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
  return normalizeResponse(payload, calcParams.length);
};

/**
 * Внешний сервис может возвращать:
 *  - { data: Material[][] }
 *  - Material[][]
 *  - Material[]  (одна конструкция)
 * Приводим всё к Material[][] длиной = количеству запрошенных конструкций.
 */
const normalizeResponse = (
  payload: unknown,
  expectedLength: number
): CalcMaterial[][] => {
  const raw =
    payload && typeof payload === "object" && "data" in payload
      ? (payload as { data: unknown }).data
      : payload;

  if (!Array.isArray(raw)) {
    return Array.from({ length: expectedLength }, () => []);
  }

  if (raw.length > 0 && Array.isArray(raw[0])) {
    return raw as CalcMaterial[][];
  }

  if (expectedLength === 1) {
    return [raw as CalcMaterial[]];
  }

  return Array.from({ length: expectedLength }, () => []);
};
