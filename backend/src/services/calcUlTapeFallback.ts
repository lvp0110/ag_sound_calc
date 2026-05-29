const VIBROSTEK_ARTICLE_CODES = new Set(["1185.1101", "1185.1102"]);

const UL_TAPE_ARTICLE = {
  Code: "1405.2101",
  Name: "Лента виброизоляционная Ультракустик F100, толщина 6мм (рулон 0,1х15м)",
  Units: "рул",
};

export const isUlTapeCalcCode = (code: string): boolean => code.endsWith("_ul_tape");

export const vibrostekCodeFromUlTape = (code: string): string =>
  code.replace(/_ul_tape$/, "_vibrostek");

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
