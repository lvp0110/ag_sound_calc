import type { CatalogEntry } from "../services/catalogData.js";
import { UL_HANGER_SUFFIX } from "../services/calcUlTapeFallback.js";

/** Порт frontend `resolveDisplayCipher` — шифр каталога по calc Code с суффиксами. */
export const resolveDisplayCipher = (
  calcCode: string,
  titleByCode: Map<string, CatalogEntry>
): string => {
  const code = String(calcCode ?? "").trim();
  if (!code) return "";
  const codeWithoutSuffix = code.split("_")[0] || code;
  if (titleByCode.size === 0) return codeWithoutSuffix;
  if (titleByCode.has(code)) return code;
  if (titleByCode.has(codeWithoutSuffix)) return codeWithoutSuffix;

  let best = "";
  for (const key of titleByCode.keys()) {
    const base = String(key ?? "").trim();
    if (!base) continue;
    if (code === base || code.startsWith(`${base}_`)) {
      if (base.length > best.length) best = base;
    }
  }
  return best || codeWithoutSuffix;
};

const HANGER_CHOICE_AG_IDS = new Set([
  "AG.C501",
  "AG.C502",
  "AG.C503",
  "AG.L404",
  "AG.L405",
]);

const isUlHangerCalcCode = (code: string): boolean => code.includes(UL_HANGER_SUFFIX);

const hasHangerChoice = (agId: string): boolean =>
  Boolean(agId) && HANGER_CHOICE_AG_IDS.has(String(agId).trim());

const UL_HANGER_TITLE_SUFFIX_PATTERN =
  /(креплениях|креплений|применением)\s+Виброфлекс.*$/iu;

/** Порт frontend `applyUltrasonicHangerDisplayText`. */
export const applyUltrasonicHangerDisplayText = ({
  title = "",
  description = "",
  agId = "",
  calcCode = "",
}: {
  title?: string;
  description?: string;
  agId?: string;
  calcCode?: string;
}): { title: string; description: string } => {
  const useUl = calcCode !== "" && isUlHangerCalcCode(String(calcCode));
  if (!useUl || !hasHangerChoice(agId)) {
    return { title: title ?? "", description: description ?? "" };
  }
  const mapLine = (text: string): string => {
    const s = String(text ?? "");
    if (!s) return s;
    return s.replace(UL_HANGER_TITLE_SUFFIX_PATTERN, (_, word: string) => `${word} Ультракустик`);
  };
  return { title: mapLine(title), description: mapLine(description) };
};

const SECTION_TYPE_BY_ID: Record<string, string> = {
  F: "ПОЛ",
  C: "ПОТОЛОК",
  L: "ОБЛИЦОВКА",
  W: "ПЕРЕГОРОДКА",
};

const SECTION_LABEL_BY_TYPE: Record<string, string> = {
  ПОТОЛОК: "Потолок",
  ПОЛ: "Пол",
  ОБЛИЦОВКА: "Облицовка",
  ПЕРЕГОРОДКА: "Перегородка",
};

const KNOWN_SECTION_LABELS = new Set(Object.values(SECTION_LABEL_BY_TYPE));

export const sectionIdFromCode = (code: string): string | null => {
  const c = String(code ?? "").trim();
  if (!c) return null;
  if (c.startsWith("AG.W")) return "W";
  if (c.startsWith("AG.C")) return "C";
  if (c.startsWith("AG.F")) return "F";
  if (c.startsWith("AG.L")) return "L";
  return null;
};

const sectionLabelFromSectionId = (sectionId: string): string => {
  const id = String(sectionId ?? "").trim();
  if (!id) return "";
  return SECTION_LABEL_BY_TYPE[SECTION_TYPE_BY_ID[id] ?? ""] ?? "";
};

const sectionLabelFromType = (type: string): string => {
  const key = String(type ?? "").trim().toUpperCase();
  if (key && SECTION_LABEL_BY_TYPE[key]) return SECTION_LABEL_BY_TYPE[key];
  const raw = String(type ?? "").trim();
  if (raw && KNOWN_SECTION_LABELS.has(raw)) return raw;
  return "";
};

const sectionLabelFromCode = (code: string): string =>
  sectionLabelFromSectionId(sectionIdFromCode(code) ?? "");

const sectionLabelForConstruction = ({
  type,
  section_id,
  ag_id,
}: {
  type: string;
  section_id: string | null;
  ag_id: string;
}): string => {
  const fromType = sectionLabelFromType(type);
  if (fromType) return fromType;
  const fromSectionId = sectionLabelFromSectionId(section_id ?? "");
  if (fromSectionId) return fromSectionId;
  return sectionLabelFromCode(ag_id);
};

export const constructionTypeFromCalcParams = (
  calcParams: Record<string, unknown> | null
): string => {
  const cp = calcParams ?? {};
  if (cp.SectionType) return String(cp.SectionType);
  const code = typeof cp.Code === "string" ? cp.Code : "";
  const sid =
    (typeof cp.SectionId === "string" && cp.SectionId) || sectionIdFromCode(code) || "";
  if (sid && SECTION_TYPE_BY_ID[sid]) return SECTION_TYPE_BY_ID[sid];
  return "";
};

const constructionDisplayTitle = ({
  title,
  type,
}: {
  title: string;
  type: string;
}): string => {
  const cleanTitle = title.trim();
  if (cleanTitle === "") return "";
  const sectionType = String(type ?? "").trim().toUpperCase();
  const isCeilingSection = sectionType === "ПОТОЛОК";
  const isCladdingSection = sectionType === "ОБЛИЦОВКА";
  const isZipsConstruction = cleanTitle.toUpperCase().startsWith("ЗИПС");
  if (isCeilingSection && isZipsConstruction) return `Потолок ${cleanTitle}`;
  if (isCladdingSection && isZipsConstruction) return `Облицовка ${cleanTitle}`;
  return cleanTitle;
};

/**
 * Заголовок секции PDF = `constructionCardHeading` на странице КП
 * (ConstructionList + mapOfferResponseToKpView).
 */
export const constructionKpCardHeading = (
  calcParams: Record<string, unknown> | null,
  catalog: Map<string, CatalogEntry>
): string => {
  if (!calcParams) return "Конструкция";

  const calcCode = typeof calcParams.Code === "string" ? calcParams.Code.trim() : "";
  const cipher = resolveDisplayCipher(calcCode, catalog);
  const meta = cipher ? catalog.get(cipher) : undefined;
  const storedDisplayTitle =
    typeof calcParams.DisplayTitle === "string" ? calcParams.DisplayTitle.trim() : "";
  const catalogName = meta?.name?.trim() ?? "";
  const looksLikeCode = (s: string) => /^AG\.[A-Z0-9._-]+$/i.test(s);
  const pickHuman = (...cands: string[]) => {
    for (const raw of cands) {
      const t = raw.trim();
      if (t && !looksLikeCode(t)) return t;
    }
    return "";
  };
  let title = pickHuman(storedDisplayTitle, catalogName) || cipher || "—";
  let description = meta?.description?.trim() ?? "";
  ({ title, description } = applyUltrasonicHangerDisplayText({
    title,
    description,
    agId: cipher,
    calcCode,
  }));
  void description;

  const type = constructionTypeFromCalcParams(calcParams);
  const sectionId =
    (typeof calcParams.SectionId === "string" && calcParams.SectionId) ||
    sectionIdFromCode(calcCode) ||
    "";

  const displayTitle = constructionDisplayTitle({ title, type });
  const normalizedCode = cipher.trim();
  const looksLikeConstructionCode = /^AG\.[A-Z0-9._-]+$/i.test(displayTitle.trim());
  const safeDisplayTitle =
    displayTitle !== "" &&
    displayTitle !== normalizedCode &&
    !looksLikeConstructionCode
      ? displayTitle
      : "";
  const constructionPart = safeDisplayTitle !== "" ? safeDisplayTitle : "Конструкция";
  const sectionLabel = sectionLabelForConstruction({
    type,
    section_id: sectionId,
    ag_id: cipher,
  });
  if (!sectionLabel) return constructionPart;
  const prefix = `${sectionLabel} `;
  if (constructionPart.toLowerCase().startsWith(prefix.toLowerCase())) {
    return constructionPart;
  }
  return `${sectionLabel} ${constructionPart}`;
};
