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

/** Шаблоны полов «по периметру» (выбор ленты и герметика). */
export const FLOOR_PERIMETER_TEMPLATES = [607.1, 608.1, 609.1, 610.1, 2.1];

/** Без варианта «Ультракустик F100 по периметру» (только К2 + Вибростек). */
export const FLOOR_NO_UL_TAPE_AG_IDS = new Set(["AG.F608", "AG.F610"]);

/** Полы с пунктом «К2 по периметру» — по умолчанию базовый шифр без суффикса. */
export const FLOOR_K2_PERIMETER_AG_IDS = new Set([
  "AG.F607",
  "AG.F608",
  "AG.F609",
  "AG.F610",
]);

/** Допустимые коды варианта ленты по периметру для шифра AG.F6xx. */
export const floorPerimeterTapeCodes = (agId) => {
  if (!agId) return [];
  const codes = [agId, `${agId}_vibrostek`];
  if (!FLOOR_NO_UL_TAPE_AG_IDS.has(agId)) {
    codes.push(`${agId}_ul_tape`);
  }
  return codes;
};

/** Базовые шифры полов с выбором типа герметика (AG.F603 … AG.F615). */
export const FLOOR_SEALANT_BASE_AG_IDS = new Set([
  "AG.F603",
  "AG.F604",
  "AG.F605",
  "AG.F606",
  "AG.F611",
  "AG.F612",
  "AG.F613",
  "AG.F614",
  "AG.F615",
]);

/** Базовый шифр AG.F6xx из полного кода (AG.F606_30, AG.F615_vibroflex_LD …). */
export const floorSealantBaseAgId = (codeOrAgId) => {
  const code = String(codeOrAgId ?? "").trim();
  const match = code.match(/^(AG\.F\d{3})/);
  return match ? match[1] : "";
};

export const hasFloorSealantChoice = ({ agId, code } = {}) => {
  const base = floorSealantBaseAgId(agId || code);
  return FLOOR_SEALANT_BASE_AG_IDS.has(base);
};

export const FLOOR_SEALANT_VIBROSIL = "vibrosil";
export const FLOOR_SEALANT_ULTRACOUSTIC = "ultracoustic";

const UL_SEALANT_BY_VIBROSIL_CODE = {
  "1177.1001": {
    Code: "1177.2001",
    Name: "Герметик вибро-акустический Ультракустик, 290 мл",
  },
  "1177.1002": {
    Code: "1177.2002",
    Name: "Герметик вибро-акустический Ультракустик, 290 мл",
  },
};

export const isFloorPerimeterTemplate = (template) =>
  FLOOR_PERIMETER_TEMPLATES.includes(template);

export const isUltracousticFloorSealant = (sealant) =>
  sealant === FLOOR_SEALANT_ULTRACOUSTIC;

/** Calc всегда отдаёт Вибросил; при выборе «Ультракустик» подменяем артикул в материалах. */
export const mapVibrosilSealantToUltracoustic = (materials) => {
  if (!Array.isArray(materials) || materials.length === 0) return null;

  let replaced = false;
  const mapped = materials.map((row) => {
    const code = String(row?.Code ?? row?.code ?? "").trim();
    const replacement = UL_SEALANT_BY_VIBROSIL_CODE[code];
    if (!replacement) return row;
    replaced = true;
    return {
      ...row,
      Code: replacement.Code,
      Name: replacement.Name,
    };
  });

  return replaced ? mapped : null;
};
