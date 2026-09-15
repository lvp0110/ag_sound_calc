/** Порт frontend/src/utils/materialPackUnits.js */
export const PACK_PRICED_MATERIALS: Record<
  string,
  { packSize: number; kpUnits: string }
> = {
  "1408.0201": { packSize: 500, kpUnits: "уп" },
};

/** Общее округление до упаковки по сумме площадей (в карточке — area / m2PerPack). */
export const AGGREGATED_PACK_MATERIALS: Record<
  string,
  { packSize: number; kpUnits: string; m2PerPack?: number }
> = {
  "1407.4100": { packSize: 1, kpUnits: "шт", m2PerPack: 30 },
};

type MaterialLike = {
  Code?: string | null;
  code?: string | null;
  Quantity?: unknown;
  KpQuantity?: unknown;
  Units?: string | null;
  Name?: string | null;
  name?: string | null;
};

export type AggregatedPackLine = {
  code: string;
  packSize: number;
  kpUnits: string;
  piecesSum: number;
  packQty: number;
  areaSumM2: number;
  sample: MaterialLike;
};

const isM2Units = (units: unknown): boolean => {
  if (units == null) return false;
  const u = String(units).trim();
  return u === "м2" || u === "м²";
};

/** Порт quantityInSquareMeters из frontend/src/utils/formatters.js */
const quantityInSquareMeters = (quantity: unknown): number => {
  const q = Number(quantity);
  if (!Number.isFinite(q)) return NaN;
  if (Math.abs(q) >= 1_000_000) return q / 1e6;
  if (Math.abs(q) > 1000) return q / 1e6;
  return q;
};

export function materialArticleCode(m: MaterialLike): string {
  return String(m?.Code ?? m?.code ?? "").trim();
}

export function isPackPricedMaterial(m: MaterialLike): boolean {
  return materialArticleCode(m) in PACK_PRICED_MATERIALS;
}

export function isAggregatedPackMaterial(m: MaterialLike): boolean {
  return materialArticleCode(m) in AGGREGATED_PACK_MATERIALS;
}

export function aggregatedPackConfig(
  articleOrMaterial: string | MaterialLike,
): { packSize: number; kpUnits: string; m2PerPack?: number } | null {
  const code =
    typeof articleOrMaterial === "string"
      ? articleOrMaterial.trim()
      : materialArticleCode(articleOrMaterial);
  return AGGREGATED_PACK_MATERIALS[code] ?? null;
}

const parseKpDecimal = (raw: unknown): number | null => {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export function rawMaterialPieces(m: MaterialLike): number {
  const kp = parseKpDecimal(m?.KpQuantity);
  if (kp !== null) return kp;
  const q = Number(m?.Quantity);
  return Number.isFinite(q) ? q : 0;
}

type ConstructionAreaLike = {
  key_id?: string;
  id?: string;
  areaM2?: unknown;
  Area?: unknown;
  area?: unknown;
  lenX?: unknown;
  LenX?: unknown;
  lenY?: unknown;
  LenY?: unknown;
  lenZ?: unknown;
  LenZ?: unknown;
  calc_params?: Record<string, unknown> | null;
};

export function areaM2FromConstructionLike(item: unknown): number {
  if (!item || typeof item !== "object") return NaN;
  const rec = item as ConstructionAreaLike;
  const src =
    rec.calc_params && typeof rec.calc_params === "object"
      ? { ...rec, ...rec.calc_params }
      : rec;
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

export function aggregatedPackUnroundedQty(
  areaM2: unknown,
  articleOrMaterial: string | MaterialLike,
): number | null {
  const cfg = aggregatedPackConfig(articleOrMaterial);
  if (!cfg?.m2PerPack || !(cfg.m2PerPack > 0)) return null;
  const area = Number(areaM2);
  if (!Number.isFinite(area) || area <= 0) return null;
  return area / cfg.m2PerPack;
}

type MaterialsByConstructionEntry = {
  key_id?: string;
  data?: MaterialLike[];
  areaM2?: unknown;
  calc_params?: Record<string, unknown> | null;
};

function entryAreaM2(
  entry: MaterialsByConstructionEntry,
  constructions?: ConstructionAreaLike[] | null,
): number {
  const direct = Number(entry?.areaM2);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const key = entry?.key_id;
  if (key != null && Array.isArray(constructions)) {
    const found = constructions.find((c) => c?.key_id === key || c?.id === key);
    const fromConstr = areaM2FromConstructionLike(found);
    if (Number.isFinite(fromConstr) && fromConstr > 0) return fromConstr;
  }
  return areaM2FromConstructionLike(entry);
}

export function kpPackQuantity(m: MaterialLike): number | null {
  const cfg = PACK_PRICED_MATERIALS[materialArticleCode(m)];
  if (!cfg) return null;
  const pieces = Number(m?.Quantity);
  if (!Number.isFinite(pieces) || pieces <= 0) return 0;
  return Math.ceil(pieces / cfg.packSize);
}

export function kpPackDisplayUnits(m: MaterialLike): string {
  const cfg = PACK_PRICED_MATERIALS[materialArticleCode(m)];
  return cfg?.kpUnits ?? (typeof m.Units === "string" ? m.Units : "—");
}

export function aggregatePackMaterialAcrossConstructions(
  materialsByConstruction: MaterialsByConstructionEntry[] | null | undefined,
  articleCode: string,
  constructions?: ConstructionAreaLike[] | null,
): AggregatedPackLine | null {
  const code = String(articleCode ?? "").trim();
  const cfg = AGGREGATED_PACK_MATERIALS[code];
  if (!cfg || !Array.isArray(materialsByConstruction)) return null;

  let areaSumM2 = 0;
  let sample: MaterialLike | null = null;
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

  const m2PerPack = cfg.m2PerPack ?? 0;
  const piecesSum = m2PerPack > 0 ? areaSumM2 / m2PerPack : 0;
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

export function listAggregatedPackMaterials(
  materialsByConstruction: MaterialsByConstructionEntry[] | null | undefined,
  constructions?: ConstructionAreaLike[] | null,
): AggregatedPackLine[] {
  return Object.keys(AGGREGATED_PACK_MATERIALS)
    .map((code) =>
      aggregatePackMaterialAcrossConstructions(
        materialsByConstruction,
        code,
        constructions,
      ),
    )
    .filter((line): line is AggregatedPackLine => line != null);
}

/** Эффективное количество для расчёта суммы на КП (KpQuantity или calc Quantity). */
export function effectiveKpQuantity(
  m: MaterialLike,
  { forKp = true }: { forKp?: boolean } = {},
): number | null {
  const kp = parseKpDecimal(m.KpQuantity);
  if (kp !== null) return kp;
  if (forKp && isPackPricedMaterial(m)) {
    return kpPackQuantity(m);
  }
  if (isM2Units(m.Units)) {
    const q = quantityInSquareMeters(m.Quantity);
    return Number.isFinite(q) ? q : null;
  }
  const q = Number(m.Quantity);
  return Number.isFinite(q) ? q : null;
}
