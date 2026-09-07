import {
  normalizePriceRegion,
  orderPriceRegions,
  resolvePriceListSource,
  type PriceRegionRow,
} from "../utils/priceRegion.js";
import { fetchCommerce } from "./commerceClient.js";
import { fetchUpstreamCached } from "./upstreamCache.js";

/**
 * Серверный аналог frontend/src/services/priceApi.js — нужен для генерации
 * PDF КП на бэке (фронтовый кэш недоступен).
 *
 * Источник: GET /commerce/regions (+ fallback /admin/commerce/regions)
 * и GET /commerce/price-list/{regionCode}.
 * Для derived-регионов цена базового прайса × price_coefficient из справочника.
 */

export type PriceRow = {
  article: string;
  name: string;
  pricePerM2?: number;
  pricePerUnit?: number;
  regionalPrices: Record<string, { pricePerM2?: number; pricePerUnit?: number }>;
};

const toNumberOrUndefined = (value: unknown): number | undefined => {
  if (value == null || value === "") return undefined;
  const normalized = typeof value === "string" ? value.replace(",", ".") : value;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : undefined;
};

const unwrapList = (body: unknown): unknown[] => {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object") {
    const p = body as Record<string, unknown>;
    if (Array.isArray(p.data)) return p.data;
    if (p.data && typeof p.data === "object" && !Array.isArray(p.data)) {
      const nested = p.data as Record<string, unknown>;
      if (Array.isArray(nested.items)) return nested.items;
    }
    if (Array.isArray(p.items)) return p.items;
  }
  return [];
};

const fetchJsonCached = async (cacheKey: string, path: string): Promise<unknown | null> => {
  try {
    const cached = await fetchUpstreamCached(cacheKey, () => fetchCommerce(path));

    if (cached.status >= 400 || cached.body.length === 0) return null;
    try {
      return JSON.parse(cached.body.toString("utf-8"));
    } catch {
      return null;
    }
  } catch {
    return null;
  }
};

const normalizeCommercePriceRow = (raw: unknown, regionCode: string): PriceRow | null => {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const article = String(obj.code ?? obj.article ?? "").trim();
  if (!article) return null;
  const pricePerM2 = toNumberOrUndefined(obj.m2 ?? obj.pricePerM2);
  const pricePerUnit = toNumberOrUndefined(obj.price ?? obj.pricePerUnit ?? obj.price_unit);
  const name = String(obj.product_name ?? obj.name ?? "").trim();
  const region = String(regionCode ?? "").trim();
  return {
    article,
    name,
    pricePerM2,
    pricePerUnit,
    regionalPrices: region ? { [region]: { pricePerM2, pricePerUnit } } : {},
  };
};

const scalePrice = (value: number | undefined, coefficient: number): number | undefined => {
  if (value == null) return undefined;
  if (!Number.isFinite(coefficient) || coefficient === 1) return value;
  return Math.round(value * coefficient * 100) / 100;
};

const applyDerivedRegionPrices = (
  rows: PriceRow[],
  regionCode: string,
  coefficient: number
): PriceRow[] => {
  const region = String(regionCode ?? "").trim();
  const coef = Number.isFinite(coefficient) && coefficient > 0 ? coefficient : 1;
  return rows.map((row) => {
    const pricePerM2 = scalePrice(row.pricePerM2, coef);
    const pricePerUnit = scalePrice(row.pricePerUnit, coef);
    return {
      ...row,
      pricePerM2,
      pricePerUnit,
      regionalPrices: region ? { [region]: { pricePerM2, pricePerUnit } } : row.regionalPrices,
    };
  });
};

const storePriceRow = (out: Map<string, PriceRow>, key: string, row: PriceRow): void => {
  out.set(key, row);
  const lower = key.toLowerCase();
  if (lower !== key) out.set(lower, row);
};

const buildByArticle = (rows: PriceRow[]): Map<string, PriceRow> => {
  const out = new Map<string, PriceRow>();
  for (const row of rows) {
    const key = row.article.trim();
    if (!key) continue;
    const existing = out.get(key) ?? out.get(key.toLowerCase());
    if (!existing) {
      storePriceRow(out, key, row);
      continue;
    }
    const merged: PriceRow = {
      ...existing,
      name: row.name && row.name.trim() ? row.name : existing.name,
      pricePerM2: existing.pricePerM2 ?? row.pricePerM2,
      pricePerUnit: existing.pricePerUnit ?? row.pricePerUnit,
      regionalPrices: { ...existing.regionalPrices, ...row.regionalPrices },
    };
    storePriceRow(out, key, merged);
  }
  return out;
};

const fetchPriceListForCode = async (regionCode: string): Promise<PriceRow[]> => {
  const region = String(regionCode ?? "").trim();
  if (!region) return [];
  const body = await fetchJsonCached(
    `commerce/price-list/${region}`,
    `/commerce/price-list/${encodeURIComponent(region)}`
  );
  if (body == null) return [];
  return unwrapList(body)
    .map((row) => normalizeCommercePriceRow(row, region))
    .filter((r): r is PriceRow => r !== null);
};

const catalogFromBody = (body: unknown): PriceRegionRow[] =>
  orderPriceRegions(
    unwrapList(body)
      .map(normalizePriceRegion)
      .filter((row): row is PriceRegionRow => row !== null)
  ).filter((row) => row.is_active !== false && row.code);

const fetchRegionCatalog = async (): Promise<PriceRegionRow[]> => {
  for (const [cacheKey, path] of [
    ["commerce/regions", "/commerce/regions"],
    ["admin/commerce/regions", "/admin/commerce/regions"],
  ] as const) {
    const body = await fetchJsonCached(cacheKey, path);
    if (body == null) continue;
    const rows = catalogFromBody(body);
    if (rows.length) return rows;
  }
  return [];
};

export type PriceLookup = (article: string | null | undefined) => {
  name?: string;
  pricePerM2?: number;
  pricePerUnit?: number;
};

const pickRegionalOrBase = (
  row: PriceRow,
  region: string,
  key: "pricePerM2" | "pricePerUnit"
): number | undefined => {
  if (region) {
    const regional = row.regionalPrices[region]?.[key];
    if (regional != null) return regional;
  }
  if (row[key] != null) return row[key];
  return undefined;
};

/**
 * Загружает прайс выбранного региона и строит lookup по артикулу.
 * `region` — код из GET /commerce/regions (offer.region).
 */
export const buildPriceLookup = async (
  region: string | null | undefined
): Promise<PriceLookup> => {
  const catalog = await fetchRegionCatalog();
  if (!catalog.length) {
    return () => ({});
  }
  const source = resolvePriceListSource(catalog, region);
  if (!source.fetchCode) {
    return () => ({});
  }

  let rows = await fetchPriceListForCode(source.fetchCode);
  if (source.fetchCode !== source.regionCode || source.coefficient !== 1) {
    rows = applyDerivedRegionPrices(rows, source.regionCode, source.coefficient);
  }

  const byArticle = buildByArticle(rows);
  return (article) => {
    if (article == null || article === "") return {};
    const key = String(article).trim();
    const row = byArticle.get(key) ?? byArticle.get(key.toLowerCase());
    if (!row) return {};
    const name = typeof row.name === "string" ? row.name.trim() || undefined : undefined;
    return {
      name,
      pricePerM2: pickRegionalOrBase(row, source.regionCode, "pricePerM2"),
      pricePerUnit: pickRegionalOrBase(row, source.regionCode, "pricePerUnit"),
    };
  };
};
