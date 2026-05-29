const VIBROSTEK_ARTICLE_CODES = new Set(["1185.1101", "1185.1102"]);

const UL_TAPE_ARTICLE = {
  Code: "1405.2101",
  Name: "Лента виброизоляционная Ультракустик F100, толщина 6мм (рулон 0,1х15м)",
  Units: "рул",
};

export const UL_TAPE_SUFFIX = "_ul_tape";
export const VIBROSTEK_SUFFIX = "_vibrostek";

export const isUlTapeCalcCode = (code: string): boolean => code.endsWith(UL_TAPE_SUFFIX);

export const vibrostekCodeFromUlTape = (code: string): string =>
  code.replace(new RegExp(`${UL_TAPE_SUFFIX}$`), VIBROSTEK_SUFFIX);

export const stripTapeSuffix = (code: string): { base: string; tape: string } => {
  const s = String(code ?? "").trim();
  if (s.endsWith(UL_TAPE_SUFFIX)) {
    return { base: s.slice(0, -UL_TAPE_SUFFIX.length), tape: UL_TAPE_SUFFIX };
  }
  if (s.endsWith(VIBROSTEK_SUFFIX)) {
    return { base: s.slice(0, -VIBROSTEK_SUFFIX.length), tape: VIBROSTEK_SUFFIX };
  }
  return { base: s, tape: "" };
};

export const ulTapeFallbackCalcCodes = (code: string): string[] => {
  const primary = vibrostekCodeFromUlTape(code);
  const { base } = stripTapeSuffix(code);
  return primary === base ? [primary] : [primary, base];
};

export const mapVibrostekMaterialsToUlTape = (
  materials: unknown[]
): unknown[] | null => {
  if (!Array.isArray(materials) || materials.length === 0) return null;

  let replaced = false;
  const mapped = materials.map((row) => {
    const rec =
      row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const code = String(rec.Code ?? rec.code ?? "").trim();
    if (!VIBROSTEK_ARTICLE_CODES.has(code)) return row;
    replaced = true;
    return {
      ...rec,
      Code: UL_TAPE_ARTICLE.Code,
      Name: UL_TAPE_ARTICLE.Name,
      Units: UL_TAPE_ARTICLE.Units,
    };
  });

  return replaced ? mapped : null;
};

export const FLOOR_SEALANT_ULTRACOUSTIC = "ultracoustic";

const UL_SEALANT_BY_VIBROSIL_CODE: Record<
  string,
  { Code: string; Name: string }
> = {
  "1177.1001": {
    Code: "1177.2001",
    Name: "Герметик вибро-акустический Ультракустик, 290 мл",
  },
  "1177.1002": {
    Code: "1177.2002",
    Name: "Герметик вибро-акустический Ультракустик, 290 мл",
  },
};

export const isUltracousticFloorSealant = (sealant: unknown): boolean =>
  sealant === FLOOR_SEALANT_ULTRACOUSTIC;

export const mapVibrosilSealantToUltracoustic = (
  materials: unknown[]
): unknown[] | null => {
  if (!Array.isArray(materials) || materials.length === 0) return null;

  let replaced = false;
  const mapped = materials.map((row) => {
    const rec =
      row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const code = String(rec.Code ?? rec.code ?? "").trim();
    const replacement = UL_SEALANT_BY_VIBROSIL_CODE[code];
    if (!replacement) return row;
    replaced = true;
    return {
      ...rec,
      Code: replacement.Code,
      Name: replacement.Name,
    };
  });

  return replaced ? mapped : null;
};
