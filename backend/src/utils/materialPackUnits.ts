/** Порт frontend/src/utils/materialPackUnits.js */
export const PACK_PRICED_MATERIALS: Record<
  string,
  { packSize: number; kpUnits: string }
> = {
  "1408.0201": { packSize: 500, kpUnits: "уп" },
};

type MaterialLike = {
  Code?: string | null;
  code?: string | null;
  Quantity?: unknown;
  Units?: string | null;
};

export function materialArticleCode(m: MaterialLike): string {
  return String(m?.Code ?? m?.code ?? "").trim();
}

export function isPackPricedMaterial(m: MaterialLike): boolean {
  return materialArticleCode(m) in PACK_PRICED_MATERIALS;
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
