/** Коды виброленты в ответе calc-сервиса для варианта *_vibrostek. */
const VIBROSTEK_ARTICLE_CODES = new Set(["1185.1101", "1185.1102"]);

/** Артикул «Лента виброизоляционная Ультракустик F100» в прайсе 1С. */
export const UL_TAPE_ARTICLE = {
  Code: "1405.2101",
  Name: "Лента виброизоляционная Ультракустик F100, толщина 6мм (рулон 0,1х15м)",
  Units: "рул",
};

export const isUlTapeCalcCode = (code) =>
  typeof code === "string" && code.endsWith("_ul_tape");

export const vibrostekCodeFromUlTape = (code) =>
  String(code).replace(/_ul_tape$/, "_vibrostek");

/**
 * В calc-сервисе пока нет *_ul_tape: берём расчёт *_vibrostek и меняем
 * виброленту на УЛ-тейп (количество и остальные позиции — как у vibrostek).
 */
export const mapVibrostekMaterialsToUlTape = (materials) => {
  if (!Array.isArray(materials) || materials.length === 0) return null;

  let replaced = false;
  const mapped = materials.map((row) => {
    const code = String(row?.Code ?? row?.code ?? "").trim();
    if (!VIBROSTEK_ARTICLE_CODES.has(code)) return row;
    replaced = true;
    return {
      ...row,
      Code: UL_TAPE_ARTICLE.Code,
      Name: UL_TAPE_ARTICLE.Name,
      Units: UL_TAPE_ARTICLE.Units,
    };
  });

  return replaced ? mapped : null;
};
