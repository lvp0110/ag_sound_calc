/**
 * Справочник регионов commerce (GET /commerce/regions) и источник прайса:
 * базовый регион × price_coefficient из API.
 */

export const PRICE_REGION_MODE_DIRECT = "direct";
export const PRICE_REGION_MODE_DERIVED = "derived";

export type PriceRegionRow = {
  id: number;
  code: string;
  name: string;
  pricing_mode: string;
  price_coefficient: number;
  is_active: boolean;
  sort_order: number;
  base_region_id: number | null;
  base_region_code: string;
  base_region: { id?: number; code?: string; name?: string } | null;
};

export const isDirectPriceRegion = (row: PriceRegionRow | null | undefined): boolean =>
  String(row?.pricing_mode || "").trim() !== PRICE_REGION_MODE_DERIVED;

export const getPriceRegionBaseId = (row: PriceRegionRow | null | undefined): number | null => {
  const n = Number(row?.base_region_id ?? row?.base_region?.id);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const normalizePriceRegion = (raw: unknown): PriceRegionRow | null => {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = Number(row.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  const base =
    row.base_region && typeof row.base_region === "object" && !Array.isArray(row.base_region)
      ? (row.base_region as { id?: number; code?: string; name?: string })
      : null;
  const mode = String(row.pricing_mode || PRICE_REGION_MODE_DIRECT).trim();
  const nestedBaseId = Number(base?.id);
  const flatBaseId = Number(row.base_region_id);
  return {
    id,
    code: row.code == null ? "" : String(row.code).trim(),
    name: row.name == null ? "" : String(row.name).trim(),
    pricing_mode: mode,
    price_coefficient: Number(row.price_coefficient) || 1,
    is_active: row.is_active !== false,
    sort_order: Number(row.sort_order) || 0,
    base_region_id:
      Number.isFinite(flatBaseId) && flatBaseId > 0
        ? flatBaseId
        : Number.isFinite(nestedBaseId) && nestedBaseId > 0
          ? nestedBaseId
          : null,
    base_region_code: String(row.base_region_code ?? base?.code ?? "").trim(),
    base_region: base,
  };
};

export const orderPriceRegions = (rows: PriceRegionRow[]): PriceRegionRow[] => {
  const directs: PriceRegionRow[] = [];
  const childrenByBase = new Map<number, PriceRegionRow[]>();
  const orphans: PriceRegionRow[] = [];
  for (const row of rows) {
    if (isDirectPriceRegion(row)) {
      directs.push(row);
      continue;
    }
    const baseId = getPriceRegionBaseId(row);
    if (!baseId) {
      orphans.push(row);
      continue;
    }
    const list = childrenByBase.get(baseId) || [];
    list.push(row);
    childrenByBase.set(baseId, list);
  }
  const ordered: PriceRegionRow[] = [];
  for (const base of directs) {
    ordered.push(base);
    ordered.push(...(childrenByBase.get(base.id) || []));
    childrenByBase.delete(base.id);
  }
  for (const leftover of childrenByBase.values()) {
    ordered.push(...leftover);
  }
  ordered.push(...orphans);
  return ordered;
};

export const findPriceRegion = (
  catalog: PriceRegionRow[],
  region: string | null | undefined
): PriceRegionRow | null => {
  const normalized = String(region ?? "").trim().toLowerCase();
  if (!normalized) return null;
  return catalog.find((row) => row.code.toLowerCase() === normalized) ?? null;
};

export type PriceListSource = {
  fetchCode: string;
  coefficient: number;
  regionCode: string;
};

/** Дочерний регион: прайс базового × коэффициент из GET /commerce/regions. */
export const resolvePriceListSource = (
  catalog: PriceRegionRow[],
  region: string | null | undefined
): PriceListSource => {
  const row = findPriceRegion(catalog, region);
  if (!row) {
    const first = catalog.find((item) => item.code.toLowerCase() === "msk") ?? catalog[0];
    const code = first?.code ?? "";
    return { fetchCode: code, coefficient: 1, regionCode: code };
  }
  if (isDirectPriceRegion(row)) {
    return { fetchCode: row.code, coefficient: 1, regionCode: row.code };
  }
  const baseId = getPriceRegionBaseId(row);
  const baseFromCatalog = baseId ? catalog.find((item) => item.id === baseId) : null;
  const baseCode = String(
    row.base_region_code || row.base_region?.code || baseFromCatalog?.code || ""
  ).trim();
  return {
    fetchCode: baseCode || row.code,
    coefficient: Number(row.price_coefficient) || 1,
    regionCode: row.code,
  };
};
