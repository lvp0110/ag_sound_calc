export const PRICE_REGION_MODE_DIRECT = "direct";
export const PRICE_REGION_MODE_DERIVED = "derived";

const flattenRef = (prefix, ref, fallback = {}) => {
  const obj = ref && typeof ref === "object" && !Array.isArray(ref) ? ref : null;
  return {
    [`${prefix}_id`]: obj?.id ?? fallback[`${prefix}_id`] ?? null,
    [`${prefix}_code`]: obj?.code ?? fallback[`${prefix}_code`] ?? null,
    [`${prefix}_name`]: obj?.name ?? fallback[`${prefix}_name`] ?? null,
  };
};

/** Нормализует регион из GET /commerce/regions или /admin/commerce/regions. */
export const normalizePriceRegion = (row) => {
  if (!row || typeof row !== "object") return null;
  const id = Number(row.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  const base =
    row.base_region && typeof row.base_region === "object"
      ? row.base_region
      : null;
  const mode = String(row.pricing_mode || PRICE_REGION_MODE_DIRECT).trim();
  return {
    ...row,
    ...flattenRef("base_region", base, row),
    id,
    code: row.code == null ? "" : String(row.code).trim(),
    name: row.name == null ? "" : String(row.name).trim(),
    pricing_mode: mode,
    base_region: base,
    price_coefficient: Number(row.price_coefficient) || 1,
    sort_order: Number(row.sort_order) || 0,
    is_active: row.is_active !== false,
  };
};

export const isDirectPriceRegion = (row) =>
  String(row?.pricing_mode || "").trim() !== PRICE_REGION_MODE_DERIVED;

export const getPriceRegionBaseId = (row) => {
  const n = Number(row?.base_region_id ?? row?.base_region?.id);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Базовые регионы, под ними их дочерние. */
export const orderPriceRegions = (rows) => {
  const directs = [];
  const childrenByBase = new Map();
  const orphans = [];
  for (const row of rows || []) {
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
  const ordered = [];
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
