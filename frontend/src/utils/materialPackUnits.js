import { isM2Units, quantityInSquareMeters } from "./formatters";

function parseKpDecimal(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Материалы, у которых calc отдаёт количество в штуках, а в прайсе цена за упаковку.
 * В калькуляторе показываем штуки; на КП — упаковки (округление вверх) в каждой конструкции.
 */
export const PACK_PRICED_MATERIALS = {
  "1408.0201": { packSize: 500, kpUnits: "уп" },
};

/**
 * Материалы с общим округлением до упаковки по всем конструкциям КП.
 * Calc Type=calcRatioPerSquare уже ceil'ит Quantity в каждой карточке — для КП
 * берём сумму площадей и расход на м² (area / m2PerPack), ceil один раз.
 *
 * 1407.4100: IsolationConstrMaterials RatioSquare=3, канистра 10 л → 30 м²/шт
 * (byProduct Quantity = Math.ceil(areaM2 / 30)).
 */
export const AGGREGATED_PACK_MATERIALS = {
  "1407.4100": { packSize: 1, kpUnits: "шт", m2PerPack: 30 },
};

export function materialArticleCode(material) {
  return String(material?.Code ?? material?.code ?? "").trim();
}

export function isPackPricedMaterial(material) {
  return materialArticleCode(material) in PACK_PRICED_MATERIALS;
}

export function isAggregatedPackMaterial(material) {
  return materialArticleCode(material) in AGGREGATED_PACK_MATERIALS;
}

export function aggregatedPackConfig(articleOrMaterial) {
  const code =
    typeof articleOrMaterial === "string"
      ? articleOrMaterial.trim()
      : materialArticleCode(articleOrMaterial);
  return AGGREGATED_PACK_MATERIALS[code] ?? null;
}

/** Сырое количество штук (KpQuantity override или Quantity), без округления до упаковки. */
export function rawMaterialPieces(material) {
  const kp = parseKpDecimal(material?.KpQuantity);
  if (kp !== null) return kp;
  const q = Number(material?.Quantity);
  return Number.isFinite(q) ? q : 0;
}

/** Площадь конструкции, м² (LenX × LenZ||LenY / 1e6, иначе Area). */
export function areaM2FromConstructionLike(item) {
  if (!item || typeof item !== "object") return NaN;
  const src =
    item.calc_params && typeof item.calc_params === "object"
      ? { ...item, ...item.calc_params }
      : item;
  const lenX = Number(src.lenX ?? src.LenX);
  const lenY = Number(src.lenY ?? src.LenY);
  const lenZ = Number(src.lenZ ?? src.LenZ);
  const heightMm = Number.isFinite(lenZ) && lenZ > 0 ? lenZ : lenY;
  if (
    Number.isFinite(lenX) &&
    lenX > 0 &&
    Number.isFinite(heightMm) &&
    heightMm > 0
  ) {
    return (lenX * heightMm) / 1e6;
  }
  const areaRaw = Number(src.areaM2 ?? src.Area ?? src.area);
  if (!Number.isFinite(areaRaw) || areaRaw <= 0) return NaN;
  if (Math.abs(areaRaw) > 1000) return areaRaw / 1e6;
  return areaRaw;
}

export function aggregatedPackUnroundedQty(areaM2, articleOrMaterial) {
  const cfg = aggregatedPackConfig(articleOrMaterial);
  if (!cfg?.m2PerPack || !(cfg.m2PerPack > 0)) return null;
  const area = Number(areaM2);
  if (!Number.isFinite(area) || area <= 0) return null;
  return area / cfg.m2PerPack;
}

export function formatUnroundedPackQty(n) {
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 1000) / 1000;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
    return String(Math.round(rounded));
  }
  return String(rounded);
}

function entryAreaM2(entry, constructions) {
  const direct = Number(entry?.areaM2);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const key = entry?.key_id;
  if (key != null && Array.isArray(constructions)) {
    const found = constructions.find(
      (c) => c?.key_id === key || c?.id === key,
    );
    const fromConstr = areaM2FromConstructionLike(found);
    if (Number.isFinite(fromConstr) && fromConstr > 0) return fromConstr;
  }
  return areaM2FromConstructionLike(entry);
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

/**
 * Сумма площадей конструкций с артикулом × расход на м² → упаковки (ceil).
 * @returns {null | {
 *   code: string,
 *   packSize: number,
 *   kpUnits: string,
 *   piecesSum: number,
 *   packQty: number,
 *   areaSumM2: number,
 *   sample: object,
 * }}
 */
export function aggregatePackMaterialAcrossConstructions(
  materialsByConstruction,
  articleCode,
  constructions,
) {
  const code = String(articleCode ?? "").trim();
  const cfg = AGGREGATED_PACK_MATERIALS[code];
  if (!cfg || !Array.isArray(materialsByConstruction)) return null;

  let areaSumM2 = 0;
  let sample = null;
  for (const entry of materialsByConstruction) {
    const data = entry?.data;
    if (!Array.isArray(data)) continue;
    let used = false;
    for (const material of data) {
      if (!material || typeof material !== "object") continue;
      if (materialArticleCode(material) !== code) continue;
      used = true;
      if (!sample) sample = material;
    }
    if (!used) continue;
    const area = entryAreaM2(entry, constructions);
    if (Number.isFinite(area) && area > 0) areaSumM2 += area;
  }
  if (!sample || !(areaSumM2 > 0)) return null;

  const piecesSum =
    cfg.m2PerPack > 0 ? areaSumM2 / cfg.m2PerPack : 0;
  if (!(piecesSum > 0)) return null;

  return {
    code,
    packSize: cfg.packSize,
    kpUnits: cfg.kpUnits,
    piecesSum,
    packQty: Math.ceil(piecesSum / cfg.packSize),
    areaSumM2,
    sample,
  };
}

/** Все агрегируемые по упаковке позиции, присутствующие в КП. */
export function listAggregatedPackMaterials(
  materialsByConstruction,
  constructions,
) {
  return Object.keys(AGGREGATED_PACK_MATERIALS)
    .map((code) =>
      aggregatePackMaterialAcrossConstructions(
        materialsByConstruction,
        code,
        constructions,
      ),
    )
    .filter(Boolean);
}

/** Эффективное количество для расчёта суммы на КП (KpQuantity или calc Quantity). */
export function effectiveKpQuantity(material, { forKp = false } = {}) {
  const kp = parseKpDecimal(material?.KpQuantity);
  if (kp !== null) return kp;
  if (forKp && isPackPricedMaterial(material)) {
    return kpPackQuantity(material);
  }
  if (isM2Units(material?.Units)) {
    const q = quantityInSquareMeters(material?.Quantity);
    return Number.isFinite(q) ? q : null;
  }
  const q = Number(material?.Quantity);
  return Number.isFinite(q) ? q : null;
}

/** Строка для поля ввода количества на КП. */
export function kpQuantityInputValue(material, { forKp = false } = {}) {
  if (material?.KpQuantity != null && material.KpQuantity !== "") {
    return String(material.KpQuantity);
  }
  const formatted = formatMaterialQuantity(material, { forKp });
  return formatted === "—" ? "" : formatted;
}

function formatRawPiecesQuantity(material) {
  const kp = parseKpDecimal(material?.KpQuantity);
  if (kp !== null) {
    if (Number.isFinite(kp)) return kp.toFixed(1);
    return String(material.KpQuantity);
  }
  const q = material?.Quantity;
  if (q == null || q === "") return "—";
  const n = Number(q);
  if (Number.isFinite(n)) return n.toFixed(1);
  return String(q);
}

/** Количество для отображения: в калькуляторе — как в calc, на КП — упаковки (кроме aggregated). */
export function formatMaterialQuantity(
  material,
  { forKp = false, areaM2 } = {},
) {
  // В составе конструкции 1407.4100 — area / m2PerPack, без ceil до упаковки.
  if (
    isAggregatedPackMaterial(material) &&
    !material?.__kpAggregatedPackLine
  ) {
    const fromArea = aggregatedPackUnroundedQty(areaM2, material);
    if (fromArea != null) return formatUnroundedPackQty(fromArea);
    return formatRawPiecesQuantity(material);
  }
  const kp = parseKpDecimal(material?.KpQuantity);
  if (kp !== null) {
    if (forKp && isPackPricedMaterial(material)) {
      return String(kp);
    }
    if (isM2Units(material?.Units)) {
      return kp.toFixed(1);
    }
    if (Number.isFinite(kp)) {
      if (forKp && Number.isInteger(kp)) return String(kp);
      return kp.toFixed(1);
    }
    return String(material.KpQuantity);
  }
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
