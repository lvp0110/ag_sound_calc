/**
 * Читает прайс Москва (*.xlsx), собирает наименование и цены руб/м², руб/ед. по артикулу.
 * Запуск: node scripts/extract-moscow-prices.mjs [путь-к-файлу.xlsx]
 */
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../src/data/moscowPricePerM2ByArticle.js");

const defaultPath =
  "/Users/viktorlapshin/Desktop/ картинки/cert_new/Москва_прайс_АГ_от_01_03_2026.xlsx";

function cellToString(val) {
  if (val == null) return "";
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "string") return val.trim();
  if (typeof val === "object") {
    if (val.text != null) return String(val.text).trim();
    if (val.result != null) return String(val.result).trim();
    if (Array.isArray(val.richText)) {
      return val.richText.map((p) => (p.text != null ? p.text : "")).join("").trim();
    }
    if (val.hyperlink && val.text) return String(val.text).trim();
  }
  return "";
}

function parseMoney(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw).replace(/\s/g, "").replace(",", ".").toLowerCase();
  if (s === "-" || s === "–" || s === "по запросу" || s === "запросу") return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeArticle(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (Number.isInteger(raw)) return String(raw);
    const t = String(raw);
    if (/^\d+\.\d+$/.test(t)) return t;
    return null;
  }
  const t = String(raw).trim();
  if (!t) return null;
  return t;
}

const UNIT_RE =
  /^(шт\.?|лист|рулон|упак\.?|м²|м2|кв\.?\s*м|п\.?\s*м|м\.?\s*п|м\.пог\.?|пог\.?\s*м|компл\.?|упаковка|ед\.?)$/i;

function isUnit(s) {
  return typeof s === "string" && UNIT_RE.test(s.trim());
}

function isArticleString(s) {
  if (!s || typeof s !== "string") return false;
  const t = s.trim();
  if (/^\d+(?:\.\d+)+$/.test(t)) return true;
  if (/^\d{5,10}$/.test(t)) return true;
  return false;
}

function isArticleRaw(cellVal, str) {
  if (typeof cellVal === "number" && Number.isFinite(cellVal)) {
    if (Number.isInteger(cellVal) && cellVal >= 10_000 && cellVal < 1e12) return true;
    const t = String(cellVal);
    if (/^\d+\.\d+$/.test(t)) return true;
    return false;
  }
  return isArticleString(str);
}

/** Последнее вхождение кода артикула в длинной строке (имя + код в тексте). */
function extractArticleFromBlob(text) {
  if (!text || text.length < 8) return null;
  const re = /\b(\d+(?:\.\d+)+|\d{5,10})\b/g;
  let last = null;
  let m;
  while ((m = re.exec(text)) !== null) last = m[1];
  return last;
}

function rowCells(row, maxCol = 12) {
  const out = [];
  for (let c = 1; c <= maxCol; c++) {
    const raw = row.getCell(c).value;
    out.push(cellToString(raw));
  }
  return out;
}

function val(row, col1) {
  return row.getCell(col1).value;
}

/** Наименование из ячейки(A…) — без служебных заголовков прайса */
function maybeName(raw) {
  const t = cellToString(raw);
  if (!t || t.length < 8) return undefined;
  if (t.includes("МАТЕРИАЛЫ ДЛЯ") && t.length < 140) return undefined;
  if (t.startsWith("Москва:") || t.startsWith("Санкт-Петербург")) return undefined;
  if (/лист\s+\d+\s+из\s+\d+/i.test(t)) return undefined;
  if (t.includes("Цены указаны в Рублях")) return undefined;
  if (t.includes("ДЕКОРАТИВНО-АКУСТИЧЕСКИЕ") && t.length < 90) return undefined;
  return t.replace(/\s+/g, " ").trim();
}

function normalizeNameForCompare(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function combineNameParts(...parts) {
  const cleaned = parts
    .map((p) => maybeName(p))
    .filter(Boolean);
  if (!cleaned.length) return undefined;
  if (cleaned.length === 1) return cleaned[0];

  const [a, b] = cleaned;
  if (normalizeNameForCompare(a) === normalizeNameForCompare(b)) return a;

  return cleaned.join(" ");
}

function rowPrices(artRaw, m2, perUnit, nameRaw) {
  const article = normalizeArticle(artRaw);
  if (!article) return null;
  if (m2 == null && perUnit == null) return null;
  const o = { article };
  if (m2 != null) o.m2 = m2;
  if (perUnit != null) o.perUnit = perUnit;
  const nm = nameRaw != null ? maybeName(nameRaw) : undefined;
  if (nm) o.name = nm;
  return o;
}

function tryParsePriceRow(row) {
  const c = [];
  for (let i = 1; i <= 12; i++) c.push(cellToString(val(row, i)));

  const c0 = c[0] || "";

  // B=артикул, C=ед., D=руб/м², E=руб/ед. (Table 2, 7…); в D может быть «-», тогда только E
  if (isArticleRaw(val(row, 2), c[1]) && isUnit(c[2])) {
    const m2 = parseMoney(c[3]);
    const perUnit = parseMoney(c[4]);
    const art = c[1] || normalizeArticle(val(row, 2));
    const got = rowPrices(art, m2, perUnit, c[0]);
    if (got) return got;
  }

  // B и C — один артикул (дубль), D=ед., E=руб/м², F=руб/ед.
  if (
    isArticleRaw(val(row, 2), c[1]) &&
    c[1] !== "" &&
    c[1] === c[2] &&
    isUnit(c[3])
  ) {
    const m2 = parseMoney(c[4]);
    const perUnit = parseMoney(c[5]);
    const got = rowPrices(c[1], m2, perUnit, c[0]);
    if (got) return got;
  }

  // C=артикул, D=ед., E=руб/м², F=руб/ед. (Table 3, 5…); в E может быть «-»
  if (isArticleRaw(val(row, 3), c[2]) && isUnit(c[3])) {
    const m2 = parseMoney(c[4]);
    const perUnit = parseMoney(c[5]);
    const nameBlob = combineNameParts(c[0], c[1]);
    const got = rowPrices(c[2] || val(row, 3), m2, perUnit, nameBlob || undefined);
    if (got) return got;
  }

  // A… длинное, E=ед., F=руб/м², G=руб/ед. (Table 1, 6)
  if (c0.length > 30 && isUnit(c[4])) {
    const m2 = parseMoney(c[5]);
    const perUnit = parseMoney(c[6]);
    const art =
      extractArticleFromBlob(c0) ||
      ((c[3] && c[3].length > 20) ? extractArticleFromBlob(c[3]) : null);
    if (art) {
      const got = rowPrices(art, m2, perUnit, c0);
      if (got) return got;
    }
  }

  // Table 4: наименование | артикул | руб/м² | руб/ед. (четвёртая колонка может быть пустой)
  if (
    c0.length > 20 &&
    isArticleString(c[1]) &&
    c[2] !== "" &&
    c[1] !== c[2] &&
    !isUnit(c[1])
  ) {
    const m2 = parseMoney(c[2]);
    const perUnit = parseMoney(c[3]);
    const got = rowPrices(c[1], m2, perUnit, c0);
    if (got) return got;
  }

  // Table 4: код внутри A, B=руб/м², C=руб/ед.
  if (
    c0.length > 30 &&
    !isArticleString(c[1]) &&
    parseMoney(c[1]) != null &&
    !isUnit(c[1])
  ) {
    const art = extractArticleFromBlob(c0);
    const m2 = parseMoney(c[1]);
    const perUnit = parseMoney(c[2]);
    if (art && (m2 != null || perUnit != null)) {
      const o = { article: normalizeArticle(art) };
      if (m2 != null) o.m2 = m2;
      if (perUnit != null) o.perUnit = perUnit;
      const nm = maybeName(c0);
      if (nm) o.name = nm;
      return o;
    }
  }

  return null;
}

async function main() {
  const xlsxPath = process.argv[2] || defaultPath;
  if (!fs.existsSync(xlsxPath)) {
    console.error("Файл не найден:", xlsxPath);
    console.error("Укажите путь: node scripts/extract-moscow-prices.mjs /path/to.xlsx");
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);

  /** @type {Record<string, { m2?: number; perUnit?: number; name?: string }>} */
  const byArticle = {};
  const duplicates = [];

  for (const ws of wb.worksheets) {
    const sheetName = String(ws.name || "").trim();
    const looksLikePriceSheet =
      /^Table\s*\d+$/i.test(sheetName) ||
      /^Table\b/i.test(sheetName) ||
      /^Sheet\d*$/i.test(sheetName);
    if (!looksLikePriceSheet) continue;

    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const cells = rowCells(row, 12);
      const first = cells[0] || "";
      if (
        first.includes("МАТЕРИАЛЫ ДЛЯ") &&
        (first.includes("лист") || first.includes("Лист"))
      )
        continue;
      if (first.includes("Цены указаны в Рублях")) continue;
      if (first.startsWith("Москва:") || first.startsWith("Санкт-Петербург")) continue;
      if (first.includes("ДЕКОРАТИВНО-АКУСТИЧЕСКИЕ") && first.length < 80) continue;
      if (/лист\s+\d+\s+из\s+\d+/i.test(first)) continue;

      const parsed = tryParsePriceRow(row);
      if (!parsed || !parsed.article) continue;

      const prev = byArticle[parsed.article] || {};
      const next = { ...prev };

      if (parsed.m2 != null) {
        if (prev.m2 != null && prev.m2 !== parsed.m2) {
          duplicates.push({
            article: parsed.article,
            field: "m2",
            was: prev.m2,
            now: parsed.m2,
            sheet: ws.name,
            row: r,
          });
        }
        next.m2 = parsed.m2;
      }
      if (parsed.perUnit != null) {
        if (prev.perUnit != null && prev.perUnit !== parsed.perUnit) {
          duplicates.push({
            article: parsed.article,
            field: "perUnit",
            was: prev.perUnit,
            now: parsed.perUnit,
            sheet: ws.name,
            row: r,
          });
        }
        next.perUnit = parsed.perUnit;
      }

      if (parsed.name) {
        if (!next.name || parsed.name.length > next.name.length) {
          next.name = parsed.name;
        }
      }

      if (next.m2 != null || next.perUnit != null) {
        byArticle[parsed.article] = next;
      }
    }
  }

  if (duplicates.length) {
    console.warn("Перезаписи цены для одного артикула:", duplicates.length);
    duplicates.slice(0, 8).forEach((d) => console.warn(d));
  }

  const sortedKeys = Object.keys(byArticle).sort();
  const list = sortedKeys.map((article) => {
    const v = byArticle[article];
    const row = { article };
    if (v.m2 != null) row.pricePerM2 = v.m2;
    if (v.perUnit != null) row.pricePerUnit = v.perUnit;
    if (v.name) row.name = v.name;
    return row;
  });

  const pricePerM2Flat = Object.fromEntries(
    sortedKeys
      .filter((a) => byArticle[a].m2 != null)
      .map((a) => [a, byArticle[a].m2])
  );
  const pricePerUnitFlat = Object.fromEntries(
    sortedKeys
      .filter((a) => byArticle[a].perUnit != null)
      .map((a) => [a, byArticle[a].perUnit])
  );

  const header = `/* Автогенерация: node scripts/extract-moscow-prices.mjs
 * Источник: Москва прайс АГ (наименование, руб./м² и руб./ед., где указано). Дата — см. имя xlsx.
 */

`;

  const body = `/** Артикул → цены из прайса */
export const moscowPriceByArticle = ${JSON.stringify(byArticle, null, 2)};

/** Совместимость: только руб/м² */
export const pricePerM2ByArticle = ${JSON.stringify(pricePerM2Flat, null, 2)};

/** Руб за единицу (шт, лист, …) */
export const pricePerUnitByArticle = ${JSON.stringify(pricePerUnitFlat, null, 2)};

/** Упорядоченный список для таблиц/отладки */
export const pricePerM2List = ${JSON.stringify(list, null, 2)};

export function getPricePerM2(article) {
  if (article == null || article === "") return undefined;
  const key = String(article).trim();
  return moscowPriceByArticle[key]?.m2;
}

export function getPricePerUnit(article) {
  if (article == null || article === "") return undefined;
  const key = String(article).trim();
  return moscowPriceByArticle[key]?.perUnit;
}
`;

  fs.writeFileSync(OUT, header + body, "utf8");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
