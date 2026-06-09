import { isM2Units, quantityInSquareMeters } from "./formatters";

/**
 * Материалы, у которых calc отдаёт количество в штуках, а в прайсе цена за упаковку.
 * В калькуляторе показываем штуки; на КП — упаковки (округление вверх).
 */
export const PACK_PRICED_MATERIALS = {
  "1408.0201": { packSize: 500, kpUnits: "уп" },
};

export function materialArticleCode(material) {
  return String(material?.Code ?? material?.code ?? "").trim();
}

export function isPackPricedMaterial(material) {
  return materialArticleCode(material) in PACK_PRICED_MATERIALS;
}

/** Количество упаковок для КП (из штук, округление вверх). */
export function kpPackQuantity(material) {
  const cfg = PACK_PRICED_MATERIALS[materialArticleCode(material)];
  if (!cfg) return null;
  const pieces = Number(material?.Quantity);
  if (!Number.isFinite(pieces) || pieces <= 0) return 0;
  return Math.ceil(pieces / cfg.packSize);
}

export function kpPackDisplayUnits(material) {
  const cfg = PACK_PRICED_MATERIALS[materialArticleCode(material)];
  return cfg?.kpUnits ?? material?.Units ?? "—";
}

/** Количество для отображения: в калькуляторе — как в calc, на КП — упаковки. */
export function formatMaterialQuantity(material, { forKp = false } = {}) {
  if (forKp && isPackPricedMaterial(material)) {
    const packs = kpPackQuantity(material);
    if (!Number.isFinite(packs)) return "—";
    return String(packs);
  }
  const q = material?.Quantity;
  if (q == null || q === "") return "—";
  if (isM2Units(material?.Units)) {
    const quantityInM2 = quantityInSquareMeters(q);
    if (Number.isNaN(quantityInM2)) return "—";
    return quantityInM2.toFixed(1);
  }
  const n = Number(q);
  if (Number.isFinite(n)) return n.toFixed(1);
  return String(q);
}

export function materialDisplayUnits(material, { forKp = false } = {}) {
  if (forKp && isPackPricedMaterial(material)) {
    return kpPackDisplayUnits(material);
  }
  return material?.Units ?? "—";
}
