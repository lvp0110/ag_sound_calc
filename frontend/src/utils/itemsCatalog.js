import ItemsBase from "../data/items.js";
import { resolveDisplayCipher } from "./calculations.js";
import { sectionIdFromCode } from "./constructionSection.js";
import {
  AG_CT_ECO_CIPHER,
  applyUltrasonicHangerDisplayText,
  isAgCtEcoCipher,
} from "./calcUlTapeFallback.js";
/** Map ag_id → item (для resolveDisplayCipher; дубликаты ag_id не мешают шифру). */
let itemsAgIdKeyMapCache = null;

export function getItemsAgIdKeyMap() {
  if (!itemsAgIdKeyMapCache) {
    itemsAgIdKeyMapCache = new Map();
    for (const item of ItemsBase) {
      if (item?.ag_id) itemsAgIdKeyMapCache.set(item.ag_id, item);
    }
  }
  return itemsAgIdKeyMapCache;
}

function normalizeItemsAgId(calcCode, cipher = "") {
  const code = String(calcCode ?? "").trim();
  const id = String(cipher ?? "").trim();
  if (isAgCtEcoCipher(id, code)) return AG_CT_ECO_CIPHER;
  const keyMap = getItemsAgIdKeyMap();
  return id || resolveDisplayCipher(code, keyMap) || "";
}

function pickItemByCalcCode(calcCode) {
  const code = String(calcCode ?? "").trim();
  if (!code) return null;
  let best = null;
  for (const item of ItemsBase) {
    const base = String(item?.ag_id ?? "").trim();
    if (!base) continue;
    if (code === base || code.startsWith(`${base}_`)) {
      if (!best || base.length > best.ag_id.length) best = item;
    }
  }
  return best;
}

function pickItemByCatalogId(catalogId, sectionId = "") {
  if (catalogId == null || catalogId === "") return null;
  const id = Number(catalogId);
  if (Number.isNaN(id)) return null;
  const matches = ItemsBase.filter((item) => item.id === id);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  const sid = String(sectionId ?? "").trim();
  if (sid) {
    return matches.find((item) => item.c_id === sid) ?? matches[0];
  }
  return matches[0];
}

function pickItemByAgIdAndSection(agId, sectionId) {
  const id = String(agId ?? "").trim();
  if (!id) return null;
  const sid = String(sectionId ?? "").trim();
  const matches = ItemsBase.filter((item) => item.ag_id === id);
  if (matches.length === 0) return null;
  if (matches.length === 1 || !sid) return matches[0];
  return matches.find((item) => item.c_id === sid) ?? matches[0];
}

function pickItemsBaseRow({ calcCode = "", cipher = "", sectionId = "", catalogId } = {}) {
  const sid =
    String(sectionId ?? "").trim() || sectionIdFromCode(calcCode) || "";
  const byCatalog = pickItemByCatalogId(catalogId, sid);
  if (byCatalog) return byCatalog;

  const agId = normalizeItemsAgId(calcCode, cipher);

  return (
    pickItemByAgIdAndSection(agId, sid) || pickItemByCalcCode(calcCode)
  );
}

/**
 * Название и описание конструкции из ItemsBase (не из AllIsolationConstr).
 * Для ЗИПС с одним ag_id в потолке и облицовке учитывается sectionId (F/C/L/W).
 */
export function resolveItemsDisplayMeta({
  calcCode = "",
  cipher = "",
  sectionId = "",
  catalogId,
} = {}) {
  const item = pickItemsBaseRow({ calcCode, cipher, sectionId, catalogId });

  if (!item) {
    return { title: "", description: "" };
  }

  return {
    /** Короткая подпись (кнопки калькулятора, детект ЗИПС). */
    title: String(item.title ?? "").trim(),
    /** Название конструкции в таблице КП/калькулятора. */
    description: String(item.description ?? "").trim(),
    catalogId: item.id,
    ag_id: String(item.ag_id ?? "").trim(),
    c_id: String(item.c_id ?? "").trim(),
  };
}

/** Имя для таблицы: ItemsBase.description, иначе title. */
export function itemsBaseTableName({ title = "", description = "" } = {}) {
  const desc = String(description ?? "").trim();
  if (desc) return desc;
  return String(title ?? "").trim();
}

/** Синхронизирует title/description/ag_id в карточках конструкций из ItemsBase. */
export function syncConstructionsTitlesFromItems(
  constructions,
  constrToCalcToSent = [],
) {
  if (!Array.isArray(constructions)) return constructions;
  return constructions.map((item, index) => {
    const cp = constrToCalcToSent[index] || {};
    const calcCode = cp.Code ?? "";
    const cipher = normalizeItemsAgId(calcCode, item?.ag_id);
    const catalogId = item?.catalog_id ?? item?.id;
    const meta = resolveItemsDisplayMeta({
      calcCode,
      cipher,
      sectionId: cp.SectionId ?? item?.section_id,
      catalogId,
    });
    const { title, description, shortTitle } = resolveConstructionTableText(item, cp);
    if (!title && !description) return item;
    const nextAgId = meta.ag_id || cipher || item.ag_id;
    if (
      item.catalog_id === meta.catalogId &&
      item.ag_id === nextAgId &&
      item.title === title &&
      item.description === description &&
      item.short_title === shortTitle
    ) {
      return item;
    }
    return {
      ...item,
      catalog_id: meta.catalogId ?? item.catalog_id,
      ag_id: nextAgId,
      title,
      description,
      short_title: shortTitle,
    };
  });
}

/**
 * Текст для таблицы: ItemsBase.description (+ подвес Ультракустик).
 */
export function resolveConstructionTableText(item, calcParams) {
  const calcCode = calcParams?.Code ?? "";
  const agId = normalizeItemsAgId(calcCode, item?.ag_id);
  const sectionId = calcParams?.SectionId ?? item?.section_id;
  const catalogId = item?.catalog_id ?? item?.id;
  let { title: shortTitle, description } = resolveItemsDisplayMeta({
    calcCode,
    cipher: agId,
    sectionId,
    catalogId,
  });
  if (!shortTitle && !description) {
    return { title: "", description: "", shortTitle: "" };
  }
  ({ title: shortTitle, description } = applyUltrasonicHangerDisplayText({
    title: shortTitle,
    description,
    agId,
    calcCode,
    hangerType: calcParams?.HangerType ?? calcParams?.hangerType,
  }));
  const tableName = itemsBaseTableName({ title: shortTitle, description });
  return {
    title: tableName,
    description: String(description ?? "").trim(),
    shortTitle: String(shortTitle ?? "").trim(),
  };
}

export function resolveConstructionTableTitle(item, calcParams) {
  return resolveConstructionTableText(item, calcParams).title;
}

export function resolveConstructionTableDescription(item, calcParams) {
  return resolveConstructionTableText(item, calcParams).description;
}
