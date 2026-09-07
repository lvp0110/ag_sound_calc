/** Опции селекта из справочника GET /commerce/regions (code + name). */
export function catalogToRegionSelectOptions(regions) {
  return (regions ?? [])
    .filter((row) => row && row.is_active !== false)
    .map((row) => {
      const code = String(row.code ?? "").trim();
      if (!code) return null;
      const name = String(row.name ?? "").trim();
      return { value: code, label: name || code };
    })
    .filter(Boolean);
}

export function findCatalogSelectOption(options, region) {
  const list = Array.isArray(options) ? options : [];
  const raw = String(region ?? "").trim();
  if (!raw) return undefined;
  const normalized = raw.toLowerCase();
  return (
    list.find((o) => o.value === raw) ||
    list.find((o) => String(o.value).toLowerCase() === normalized)
  );
}

/** Цена базового региона × коэффициент дочернего из API. */
export function scalePriceByCoefficient(value, coefficient) {
  if (value == null || value === "") return value;
  const coef = Number(coefficient);
  if (!Number.isFinite(coef) || coef === 1) return value;
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return Math.round(num * coef * 100) / 100;
}

/**
 * Прайс базового региона → прайс дочернего (price_coefficient из API).
 * @param {object[]} rows
 * @param {{ regionCode?: string, coefficient?: number }} [options]
 */
export function applyDerivedRegionPrices(rows, { regionCode, coefficient } = {}) {
  const region = String(regionCode ?? "").trim();
  const coef = Number(coefficient);
  const safeCoef = Number.isFinite(coef) && coef > 0 ? coef : 1;
  return (rows ?? []).map((row) => {
    const pricePerM2 = scalePriceByCoefficient(row.pricePerM2, safeCoef);
    const pricePerUnit = scalePriceByCoefficient(row.pricePerUnit, safeCoef);
    return {
      ...row,
      pricePerM2,
      pricePerUnit,
      regionalPrices: region
        ? { [region]: { pricePerM2, pricePerUnit } }
        : row.regionalPrices,
    };
  });
}

export function getRegionDisplayLabel(region, catalog) {
  const raw = String(region ?? "").trim();
  if (!raw) return "";
  const option = findCatalogSelectOption(
    catalogToRegionSelectOptions(catalog),
    raw
  );
  if (option?.label) return option.label;
  const fromCatalog = (catalog ?? []).find((row) => {
    const code = String(row?.code ?? "").trim().toLowerCase();
    return code === raw.toLowerCase();
  });
  if (fromCatalog?.name) return fromCatalog.name;
  return raw;
}
