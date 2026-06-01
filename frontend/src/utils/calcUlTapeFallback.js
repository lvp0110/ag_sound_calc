/** Коды виброленты в ответе calc-сервиса для варианта *_vibrostek. */
const VIBROSTEK_ARTICLE_CODES = new Set(["1185.1101", "1185.1102"]);

/** Артикул «Лента виброизоляционная Ультракустик F100» в прайсе 1С. */
export const UL_TAPE_ARTICLE = {
  Code: "1405.2101",
  Name: "Лента виброизоляционная Ультракустик F100, толщина 6мм (рулон 0,1х15м)",
  Units: "рул",
};

export const UL_TAPE_SUFFIX = "_ul_tape";
export const VIBROSTEK_SUFFIX = "_vibrostek";
export const UL_HANGER_SUFFIX = "_ul_hanger";

export const HANGER_VIBROSTEK = "vibrostek";
export const HANGER_ULTRACOUSTIC = "ultracoustic";

/** Конструкции с выбором типа подвеса (Вибростек / Ультракустик). */
export const HANGER_CHOICE_AG_IDS = new Set([
  "AG.C501",
  "AG.C502",
  "AG.C503",
  "AG.L404",
  "AG.L405",
]);

export const isUlHangerCalcCode = (code) =>
  typeof code === "string" && code.includes(UL_HANGER_SUFFIX);

export const hangerTypeFromCode = (code) =>
  isUlHangerCalcCode(code) ? HANGER_ULTRACOUSTIC : HANGER_VIBROSTEK;

/** Убирает суффикс подвеса с полного кода (в т.ч. AG.C501_ul_hanger). */
export const stripHangerSuffix = (code) => {
  const s = String(code ?? "").trim();
  if (s.endsWith(UL_HANGER_SUFFIX)) {
    return { base: s.slice(0, -UL_HANGER_SUFFIX.length), hanger: UL_HANGER_SUFFIX };
  }
  return { base: s, hanger: "" };
};

export const hasHangerChoice = (agId) =>
  Boolean(agId) && HANGER_CHOICE_AG_IDS.has(String(agId).trim());

/** «креплениях/креплений/применением Виброфлекс-…» → «… Ультракустик» в UI-названии. */
const UL_HANGER_TITLE_SUFFIX_PATTERN =
  /(креплениях|креплений|применением)\s+Виброфлекс.*$/iu;

/**
 * Подмена типа подвеса в title/description для AG.C501–503 и AG.L404–405,
 * если выбран Ультракустик (по hangerType или суффиксу *_ul_hanger в calcCode).
 */
export function applyUltrasonicHangerDisplayText({
  title = "",
  description = "",
  agId = "",
  calcCode = "",
  hangerType,
} = {}) {
  const useUl =
    hangerType === HANGER_ULTRACOUSTIC ||
    (calcCode && isUlHangerCalcCode(String(calcCode)));

  if (!useUl || !hasHangerChoice(agId)) {
    return { title: title ?? "", description: description ?? "" };
  }

  const mapLine = (text) => {
    const s = String(text ?? "");
    if (!s) return s;
    return s.replace(
      UL_HANGER_TITLE_SUFFIX_PATTERN,
      (_, word) => `${word} Ультракустик`,
    );
  };

  return {
    title: mapLine(title),
    description: mapLine(description),
  };
}

/** Подвесы Виброфлекс в ответе calc для базового шифра (AG.C501 … AG.L405). */
const VIBROFLEX_HANGER_ARTICLE_CODES = new Set([
  "2316.3010",
  "2316.1010",
  "2316.4020",
  "2316.2020",
]);

/** Артикул «Подвес виброизолирующий Ультракустик универсальный» в прайсе 1С. */
export const UL_HANGER_ARTICLE = {
  Code: "2406.5000",
  Name: "Подвес виброизолирующий Ультракустик универсальный",
  Units: "шт",
};

/** Код без суффикса *_ul_hanger (для fallback: AG.C501_ul_tape_ul_hanger → AG.C501_ul_tape). */
export const ulHangerFallbackCalcCode = (code) => stripHangerSuffix(code).base;

/**
 * В calc-сервисе пока нет *_ul_hanger: считаем базовый шифр (и при необходимости
 * цепочку *_ul_tape) и меняем подвес Виброфлекс на Ультракустик.
 */
export const mapVibroflexHangerToUltracoustic = (materials) => {
  if (!Array.isArray(materials) || materials.length === 0) return null;

  let replaced = false;
  const mapped = materials.map((row) => {
    const code = String(row?.Code ?? row?.code ?? "").trim();
    if (!VIBROFLEX_HANGER_ARTICLE_CODES.has(code)) return row;
    replaced = true;
    return {
      ...row,
      Code: UL_HANGER_ARTICLE.Code,
      Name: UL_HANGER_ARTICLE.Name,
      Units: UL_HANGER_ARTICLE.Units,
    };
  });

  return replaced ? mapped : null;
};

export const isUlTapeCalcCode = (code) =>
  typeof code === "string" && code.endsWith(UL_TAPE_SUFFIX);

export const vibrostekCodeFromUlTape = (code) =>
  String(code).replace(new RegExp(`${UL_TAPE_SUFFIX}$`), VIBROSTEK_SUFFIX);

/** Убирает суффикс ленты с полного кода (в т.ч. AG.C501_ul_tape). */
export const stripTapeSuffix = (code) => {
  const s = String(code ?? "").trim();
  if (s.endsWith(UL_TAPE_SUFFIX)) {
    return { base: s.slice(0, -UL_TAPE_SUFFIX.length), tape: UL_TAPE_SUFFIX };
  }
  if (s.endsWith(VIBROSTEK_SUFFIX)) {
    return { base: s.slice(0, -VIBROSTEK_SUFFIX.length), tape: VIBROSTEK_SUFFIX };
  }
  return { base: s, tape: "" };
};

/** Коды для fallback *_ul_tape: сначала *_vibrostek (полы), затем базовый (потолки). */
export const ulTapeFallbackCalcCodes = (code) => {
  const primary = vibrostekCodeFromUlTape(code);
  const { base } = stripTapeSuffix(code);
  return primary === base ? [primary] : [primary, base];
};

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

/** Потолки без выбора ленты по периметру (ЗИПС-Синема). */
export const CEILING_NO_TAPE_AG_IDS = new Set(["AG.Z205"]);

export const hasCeilingTapeChoice = (agId) =>
  Boolean(agId) && !CEILING_NO_TAPE_AG_IDS.has(agId);

/** Допустимые коды ленты по периметру для потолков (AG.C5xx, AG.Z20x). */
export const ceilingPerimeterTapeCodes = (agId) => {
  if (!hasCeilingTapeChoice(agId)) return [];
  return [agId, `${agId}${UL_TAPE_SUFFIX}`];
};

/** ЗИПС-облицовка без выбора ленты (Синема). */
export const FACING_NO_TAPE_AG_IDS = new Set(["AG.Z205"]);

/** Облицовка с выбором ленты (каркас / Виброфлекс). */
export const FACING_TAPE_L_AG_IDS = new Set(["AG.L401", "AG.L404", "AG.L405"]);

/** Перегородки с выбором ленты по периметру. */
export const PARTITION_TAPE_AG_IDS = new Set(["AG.W103", "AG.W104", "AG.W105"]);

/** Конструкции без выбора типа гипсокартона (фиксированный состав). */
export const GKLA_NO_CHOICE_AG_IDS = new Set(["AG.W108"]);

export const hasGklaChoice = (agId) =>
  Boolean(agId) && !GKLA_NO_CHOICE_AG_IDS.has(String(agId).trim());

export const hasFacingTapeChoice = (agId) => {
  if (!agId || FACING_NO_TAPE_AG_IDS.has(agId)) return false;
  if (FACING_TAPE_L_AG_IDS.has(agId)) return true;
  if (PARTITION_TAPE_AG_IDS.has(agId)) return true;
  return String(agId).startsWith("AG.Z");
};

/** Допустимые коды ленты по периметру для облицовки. */
export const facingPerimeterTapeCodes = (agId) => {
  if (!hasFacingTapeChoice(agId)) return [];
  return [agId, `${agId}${UL_TAPE_SUFFIX}`];
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
