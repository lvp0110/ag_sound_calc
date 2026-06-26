import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ConstructionCatalogEntry } from "../services/catalogData.js";
import type { PriceLookup } from "../services/priceData.js";
import { constructionKpCardHeading } from "../utils/constructionKpDisplay.js";
import { formatDateRu } from "../utils/formatDateRu.js";
import {
  isPackPricedMaterial,
  kpPackDisplayUnits,
  kpPackQuantity,
} from "../utils/materialPackUnits.js";
import { numberToWordsRu, pluralRu, rublesToWordsRu } from "../utils/numberToWordsRu.js";
import { UPLOADS_DIR } from "../routes/uploads.js";

/**
 * HTML-шаблон коммерческого предложения «Шуманет Шоп».
 *
 * Сам HTML+CSS живёт в соседнем `offerKp.html` — это удобно для редактирования
 * без правки TS-логики. Здесь мы:
 *   1) читаем HTML с диска (с кэшем — `import.meta.url` указывает на src/ в dev
 *      под tsx-watch, и на dist/ в prod после `npm run build` + copy-step);
 *   2) формируем динамические куски (строки таблицы) на JS — циклы плейсхолдером
 *      не выразить;
 *   3) выполняем простую подстановку {{PLACEHOLDER}} (без template-движка).
 *
 * Подставляемые значения, которые приходят из offer/DTO (имя, объект, и т.д.)
 * — экранируются esc() до подстановки, защита от XSS. Значения,
 * которые мы сами генерируем как HTML (строки секций), помечены явно.
 */

const TEMPLATE_PATH = fileURLToPath(new URL("./offerKp.html", import.meta.url));

let cachedTemplate: string | null = null;
const loadTemplate = (): string => {
  // В dev читаем шаблон с диска каждый раз, чтобы правки offerKp.html
  // применялись сразу без перезапуска backend-процесса.
  if (process.env.NODE_ENV !== "production") {
    return readFileSync(TEMPLATE_PATH, "utf-8");
  }
  if (cachedTemplate === null) {
    cachedTemplate = readFileSync(TEMPLATE_PATH, "utf-8");
  }
  return cachedTemplate;
};

/**
 * Сбросить кэш HTML-шаблона. Используется только для тестов / hot-reload
 * вне tsx-watch (последний не отслеживает .html). В runtime backend'а не нужен.
 */
export const __resetTemplateCache = (): void => {
  cachedTemplate = null;
};

// ─── shape of incoming DTO ──────────────────────────────────────────────────

type ServiceLike = {
  name?: string | null;
  price?: number | null;
  count?: number | null;
  unit?: string | null;
} & Record<string, unknown>;

type MaterialLike = {
  Code?: string | null;
  articul?: string | null;
  Name?: string | null;
  name?: string | null;
  Quantity?: number | string | null;
  Units?: string | null;
  KpPricePerM2?: number | string | null;
  KpPricePerUnit?: number | string | null;
  pricePerSquareMeter?: number | null;
  pricePerUnit?: number | null;
} & Record<string, unknown>;

type ConstructionLike = {
  id: string;
  position: number;
  calc_params: Record<string, unknown> | null;
  materials: MaterialLike[] | null;
  montage: ServiceLike[] | null;
};

export type OfferForRender = {
  id: string;
  manager_name: string | null;
  phone: string | null;
  email: string | null;
  kp_date: string | null;
  object_name: string | null;
  region: string | null;
  logo_url: string | null;
  company_name: string | null;
  company_address: string | null;
  company_phone: string | null;
  ogrn: string | null;
  ogrnip: string | null;
  kpp: string | null;
  inn: string | null;
  /**
   * Транзитные параметры печати: приходят query-параметрами запроса на /pdf,
   * в БД НЕ хранятся. Пустое значение → в PDF подставляется дефолт.
   *   recipient        — адресат («кому адресовано»), вступление;
   *   payment_schedule — график оплаты, блок условий;
   *   delivery_method  — способ доставки, блок условий;
   *   warehouse        — склад, блок условий;
   *   offer_validity   — срок действия предложения, блок условий.
   */
  recipient?: string | null;
  payment_schedule?: string | null;
  delivery_method?: string | null;
  warehouse?: string | null;
  offer_validity?: string | null;
  services: ServiceLike[] | null;
  additional_materials: ServiceLike[] | null;
  constructions: ConstructionLike[];
};

export type RenderInput = {
  offer: OfferForRender;
  priceLookup: PriceLookup;
  catalog: Map<string, ConstructionCatalogEntry>;
  /** HTML-блок «Информация о конструкциях» (характеристики, состав, изображения). */
  constructionDetailsHtml?: string;
};

// ─── pricing math (порт из frontend/src/components/tables/MaterialsList.jsx) ──

const parseKpDecimal = (raw: unknown): number | null => {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
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

const effectivePrices = (m: MaterialLike, pPerM2?: number, pPerUnit?: number) => {
  const kpM2 = parseKpDecimal(m.KpPricePerM2);
  const kpUnit = parseKpDecimal(m.KpPricePerUnit);
  return {
    effM2: kpM2 !== null ? kpM2 : pPerM2,
    effUnit: kpUnit !== null ? kpUnit : pPerUnit,
  };
};

const materialLineSum = (
  m: MaterialLike,
  pPerM2: number | undefined,
  pPerUnit: number | undefined
): number | null => {
  const { effM2, effUnit } = effectivePrices(m, pPerM2, pPerUnit);
  if (isM2Units(m.Units)) {
    const qtyM2 = quantityInSquareMeters(m.Quantity);
    if (!Number.isFinite(qtyM2)) return null;
    if (effM2 != null) return qtyM2 * effM2;
    if (effUnit != null) return qtyM2 * effUnit;
    return null;
  }
  if (isPackPricedMaterial(m)) {
    const packs = kpPackQuantity(m);
    if (packs == null || !Number.isFinite(packs)) return null;
    if (effUnit != null) return packs * effUnit;
    return null;
  }
  if (effUnit != null) {
    const q = Number(m.Quantity);
    if (!Number.isFinite(q)) return null;
    return q * effUnit;
  }
  return null;
};

// Цена за единицу к показу в колонке «Цена с НДС, RUB».
const materialUnitPriceForDisplay = (
  m: MaterialLike,
  pPerM2: number | undefined,
  pPerUnit: number | undefined
): number | null => {
  const { effM2, effUnit } = effectivePrices(m, pPerM2, pPerUnit);
  if (isM2Units(m.Units)) {
    // Для м² показываем цену за м² — она «человекочитаемая» в этой колонке.
    if (effM2 != null) return effM2;
    if (effUnit != null) return effUnit;
    return null;
  }
  return effUnit ?? null;
};

const materialQuantityForDisplay = (m: MaterialLike): number => {
  if (isPackPricedMaterial(m)) {
    const packs = kpPackQuantity(m);
    return packs ?? 0;
  }
  if (isM2Units(m.Units)) {
    const q = quantityInSquareMeters(m.Quantity);
    return Number.isFinite(q) ? q : 0;
  }
  const q = Number(m.Quantity);
  return Number.isFinite(q) ? q : 0;
};

const materialArticle = (m: MaterialLike): string => {
  const code = typeof m.Code === "string" ? m.Code.trim() : "";
  if (code) return code;
  const articul = typeof m.articul === "string" ? m.articul.trim() : "";
  return articul;
};

/** Fallback-название из calc (без артикула), если в прайсе нет имени. */
const materialFallbackName = (m: MaterialLike): string => {
  const name = typeof m.Name === "string" && m.Name.trim() !== ""
    ? m.Name.trim()
    : typeof m.name === "string" && m.name.trim() !== ""
      ? m.name.trim()
      : "";
  return name || "—";
};

/**
 * Как `filterVariable` на фронте (formatters.js): в колонке «артикул» показывается
 * код только если он начинается с цифры, иначе «---» (блок «Общестроительные»).
 */
const hasKpTableArticle = (code: unknown): boolean => {
  if (code == null) return false;
  return /^\d/.test(String(code).trim());
};

/**
 * Порядок строк материалов как в таблице КП (ConstructionList.splitMaterialsByArticleDisplay):
 * сначала позиции с артикулом, затем «общестроительные»; внутри групп — порядок из массива.
 */
const orderMaterialsLikeKpTable = (materials: MaterialLike[]): MaterialLike[] => {
  const withArticle: MaterialLike[] = [];
  const noArticle: MaterialLike[] = [];
  for (const m of materials) {
    if (hasKpTableArticle(m.Code)) withArticle.push(m);
    else noArticle.push(m);
  }
  return [...withArticle, ...noArticle];
};

// ─── helpers ────────────────────────────────────────────────────────────────

const fmtRub = (v: number | null | undefined): string => {
  if (v == null || !Number.isFinite(v)) return "—";
  return Number(v).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const fmtQty = (v: number): string => {
  if (!Number.isFinite(v)) return "—";
  // Целые без знаков после запятой, дробные с двумя.
  if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
  return v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/**
 * Собирает HTML логотипа для шапки КП. Логотип берётся из компании (logo_url).
 * Если URL пуст, файл не читается или расширение не поддерживается — возвращаем
 * пустую строку (дефолтного логотипа нет). Картинка вставляется как data: URI —
 * puppeteer рендерит без сети.
 */
const buildLogoBlockHtml = (logoUrl: string | null | undefined): string => {
  if (!logoUrl) return "";
  // Защита от path traversal — берём только basename.
  const filename = path.basename(logoUrl);
  const ext = path.extname(filename).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) return "";
  try {
    const buf = readFileSync(path.join(UPLOADS_DIR, filename));
    const b64 = buf.toString("base64");
    return `<img class="logo-img" src="data:${mime};base64,${b64}" alt="">`;
  } catch {
    return "";
  }
};

const esc = (s: unknown): string => {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

// ─── render ─────────────────────────────────────────────────────────────────

export function renderOfferKpHtml({
  offer,
  priceLookup,
  catalog,
  constructionDetailsHtml = "",
}: RenderInput): string {
  // Подготовка строк таблицы + промежуточных сумм.
  type RenderedSection = {
    name: string;
    sectionTotal: number;
    rows: Array<{
      name: string;
      unit: string;
      qty: number;
      unitPrice: number | null;
      lineSum: number | null;
    }>;
  };

  const sections: RenderedSection[] = [];

  // Правило: в PDF — те же строки, что на КП, кроме позиций с суммой 0,00
  // (null/NaN с экрана КП считаем нулём). Заголовок секции — если есть ≥1 такая строка.
  const materialLineSumForFilter = (
    m: MaterialLike,
    pPerM2: number | undefined,
    pPerUnit: number | undefined
  ): number => {
    const sum = materialLineSum(m, pPerM2, pPerUnit);
    return typeof sum === "number" && Number.isFinite(sum) ? sum : 0;
  };

  const hasPositiveLineSum = (lineSum: number | null | undefined): boolean =>
    (typeof lineSum === "number" && Number.isFinite(lineSum) ? lineSum : 0) > 0;

  type RenderedRow = RenderedSection["rows"][number];

  const serviceLineSum = (item: ServiceLike): number => {
    const price = parseKpDecimal(item.price) ?? 0;
    const count = parseKpDecimal(item.count) ?? 0;
    return price * count;
  };

  const pushPricedServiceRow = (
    rows: RenderedRow[],
    sectionTotal: { value: number },
    item: ServiceLike,
    fallbackName: string
  ): void => {
    const lineSum = serviceLineSum(item);
    if (!hasPositiveLineSum(lineSum)) return;
    const price = parseKpDecimal(item.price) ?? 0;
    const count = parseKpDecimal(item.count) ?? 0;
    sectionTotal.value += lineSum;
    rows.push({
      name: String(item.name ?? fallbackName),
      unit: String(item.unit ?? ""),
      qty: count,
      unitPrice: price,
      lineSum,
    });
  };

  /** Порядок как в offer.additional_materials (PATCH сохраняет порядок строк по карточкам). */
  const additionalByConstructionId = new Map<string, ServiceLike[]>();
  for (const m of offer.additional_materials || []) {
    const raw = m.construction_key_id;
    const keyId =
      typeof raw === "string"
        ? raw.trim()
        : typeof raw === "number"
          ? String(raw)
          : "";
    if (!keyId) continue;
    const bucket = additionalByConstructionId.get(keyId);
    if (bucket) bucket.push(m);
    else additionalByConstructionId.set(keyId, [m]);
  }

  const constructionsOrdered = [...(offer.constructions || [])].sort(
    (a, b) => a.position - b.position
  );

  // Карточка конструкции на КП: материалы → доп. материалы → монтаж (в одной секции PDF).
  for (const c of constructionsOrdered) {
    const materials = orderMaterialsLikeKpTable(
      Array.isArray(c.materials) ? c.materials : []
    );
    const rows: RenderedRow[] = [];
    const sectionTotal = { value: 0 };

    for (const m of materials) {
      const article = materialArticle(m);
      const lookedUp = priceLookup(article);
      const { pricePerM2, pricePerUnit, name: catalogName } = lookedUp;
      const unitPrice = materialUnitPriceForDisplay(m, pricePerM2, pricePerUnit);
      const qty = materialQuantityForDisplay(m);
      const lineSum = materialLineSum(m, pricePerM2, pricePerUnit);
      if (!hasPositiveLineSum(materialLineSumForFilter(m, pricePerM2, pricePerUnit))) continue;
      sectionTotal.value += materialLineSumForFilter(m, pricePerM2, pricePerUnit);
      rows.push({
        name: catalogName?.trim() || materialFallbackName(m),
        unit: isPackPricedMaterial(m)
          ? kpPackDisplayUnits(m)
          : typeof m.Units === "string"
            ? m.Units
            : "—",
        qty,
        unitPrice,
        lineSum,
      });
    }

    for (const m of additionalByConstructionId.get(c.id) || []) {
      pushPricedServiceRow(rows, sectionTotal, m, "");
    }

    const montageArr = Array.isArray(c.montage) ? c.montage : [];
    if (montageArr[0]) {
      pushPricedServiceRow(rows, sectionTotal, montageArr[0], "Монтаж");
    }

    if (rows.length === 0) continue;
    sections.push({
      name: constructionKpCardHeading(c.calc_params, catalog),
      sectionTotal: sectionTotal.value,
      rows,
    });
  }

  // Услуги — только строки с положительной суммой (цена × кол-во).
  {
    const rows: RenderedSection["rows"] = [];
    let total = 0;
    for (const s of offer.services || []) {
      const lineSum = serviceLineSum(s);
      if (!hasPositiveLineSum(lineSum)) continue;
      const price = parseKpDecimal(s.price) ?? 0;
      const count = parseKpDecimal(s.count) ?? 0;
      total += lineSum;
      rows.push({
        name: String(s.name ?? ""),
        unit: String(s.unit ?? ""),
        qty: count,
        unitPrice: price,
        lineSum,
      });
    }
    if (rows.length > 0) {
      sections.push({ name: "Услуги", sectionTotal: total, rows });
    }
  }

  const grandTotal = sections.reduce((acc, s) => acc + s.sectionTotal, 0);
  const ndsAmount = Math.round((grandTotal * 20) / 120 * 100) / 100;

  // Подсчёт количества «наименований» (как в образце: общее число строк).
  const itemsCount = sections.reduce((acc, s) => acc + s.rows.length, 0);
  const itemsCountWords = numberToWordsRu(itemsCount, "n");
  const itemsCountWordsCap = itemsCountWords.charAt(0).toUpperCase() + itemsCountWords.slice(1);
  const itemsNoun = pluralRu(itemsCount, ["наименование", "наименования", "наименований"]);

  const grandWords = rublesToWordsRu(grandTotal);

  // Сборка динамических строк таблицы. Внутри row.name / row.unit и т.д. —
  // экранируем; <tr>/<td> — наш собственный HTML, доверенный.
  let sectionsHtml = "";
  sections.forEach((sec, sIdx) => {
    const sectionNo = sIdx + 1;
    sectionsHtml += `
      <tr class="section-row">
        <td class="num"><strong>${sectionNo}</strong></td>
        <td class="name section-title" colspan="4"><strong>${esc(sec.name)}</strong></td>
        <td class="sum"><strong>${fmtRub(sec.sectionTotal)}</strong></td>
      </tr>`;
    sec.rows.forEach((row, rIdx) => {
      const itemNo = `${sectionNo}.${rIdx + 1}`;
      sectionsHtml += `
      <tr class="item-row">
        <td class="num">${esc(itemNo)}</td>
        <td class="name">${esc(row.name)}</td>
        <td class="unit">${esc(row.unit)}</td>
        <td class="qty">${esc(fmtQty(row.qty))}</td>
        <td class="price">${fmtRub(row.unitPrice)}</td>
        <td class="sum">${fmtRub(row.lineSum)}</td>
      </tr>`;
    });
  });

  const dateStr = formatDateRu(offer.kp_date);

  // Блок условий: только транзитные значения из диалога печати. Дефолтов нет —
  // строки с пустым значением в PDF НЕ выводим.
  const conditionRows: Array<[string, string]> = [];
  const pushCondition = (label: string, value: string): void => {
    const v = value.trim();
    if (v !== "") conditionRows.push([label, v]);
  };
  pushCondition("График оплаты", (offer.payment_schedule ?? "").trim());
  pushCondition("Способ доставки", (offer.delivery_method ?? "").trim());
  pushCondition("Склад", (offer.warehouse ?? "").trim());
  pushCondition(
    "Срок действия предложения",
    (offer.offer_validity ?? "").trim()
  );
  const conditionsBlock =
    conditionRows.length === 0
      ? ""
      : `<div class="conditions">
    <h3>Также предлагаем Вам ознакомиться с остальными условиями нашего предложения:</h3>
    <table>
      ${conditionRows
        .map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`)
        .join("\n      ")}
    </table>
  </div>`;

  const placeholders: Record<string, string> = {
    TITLE: esc(offer.id),
    ISSUE_DATE: dateStr ? `от ${esc(dateStr)}` : "",
    OBJECT_NAME: esc(offer.object_name ?? ""),
    SECTIONS: sectionsHtml,
    CONSTRUCTION_DETAILS: constructionDetailsHtml,
    NDS_AMOUNT: fmtRub(ndsAmount),
    GRAND_TOTAL: fmtRub(grandTotal),
    ITEMS_NOUN: esc(itemsNoun),
    ITEMS_COUNT: String(itemsCount),
    ITEMS_COUNT_WORDS: esc(itemsCountWordsCap),
    GRAND_TOTAL_WORDS: esc(grandWords),
    // Готовый HTML блока условий (пустые строки исключены; пустой блок → "").
    CONDITIONS_BLOCK: conditionsBlock,
    MANAGER_NAME: esc(offer.manager_name ?? ""),
    MANAGER_EMAIL: esc(offer.email ?? ""),
    // Телефон менеджера из формы КП — выводится в теле рядом с почтой.
    MANAGER_PHONE: esc(offer.phone ?? ""),
    // HTML, не esc(): либо <img data: URI>, либо дефолтный брендовый блок.
    LOGO_BLOCK: buildLogoBlockHtml(offer.logo_url),
    // Адресат во вступительной фразе «Компания ООО «...» предлагает Вам».
    // Это «кому адресовано» (offer.recipient) — транзитное поле из запроса
    // на /pdf, в БД не хранится. Обёртка «ООО «»» зафиксирована в шаблоне, в
    // плейсхолдер кладём «голое» название. При пустом поле — «Шуманет Шоп».
    INTRO_COMPANY: esc(
      (offer.recipient ?? "").trim() !== ""
        ? (offer.recipient as string).trim()
        : "Шуманет Шоп"
    ),
  };

  return applyPlaceholders(loadTemplate(), placeholders);
}

/**
 * Простая подстановка `{{KEY}}` → значение. Без regex-эскейпа в значении —
 * нам не нужен replace (с paddings $&), используем split/join, который
 * трактует replacement буквально.
 */
const applyPlaceholders = (template: string, values: Record<string, string>): string => {
  let out = template;
  for (const [key, value] of Object.entries(values)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
};

/**
 * Дефолтные реквизиты для футера PDF. Используются по-полю, если
 * соответствующее поле в Offer не заполнено (см. buildFooterHtml).
 */
const DEFAULT_FOOTER = {
  companyName: "",
  companyAddress: "",
  phone: "",
  ogrn: "",
  ogrnip: "",
  kpp: "",
  inn: "",
} as const;

/**
 * Футер PDF собирается на каждый рендер: значения из Offer
 * (company_name / company_address / company_phone / ogrn / ogrnip / inn / kpp) подставляются
 * по-полю; пустые поля и соответствующие строки не выводятся.
 */
export const buildFooterHtml = (offer: OfferForRender): string => {
  const pick = (val: string | null | undefined, fallback: string): string => {
    const s = (val ?? "").trim();
    return s !== "" ? s : fallback;
  };
  const companyName = pick(offer.company_name, DEFAULT_FOOTER.companyName);
  const companyAddress = pick(offer.company_address, DEFAULT_FOOTER.companyAddress);
  // В колонтитуле — телефон компании (не менеджера).
  const phone = pick(offer.company_phone, DEFAULT_FOOTER.phone);
  const ogrn = pick(offer.ogrn, DEFAULT_FOOTER.ogrn);
  const ogrnip = pick(offer.ogrnip, DEFAULT_FOOTER.ogrnip);
  const kpp = pick(offer.kpp, DEFAULT_FOOTER.kpp);
  const inn = pick(offer.inn, DEFAULT_FOOTER.inn);

  const phoneLine =
    phone !== "" ? `<div>Тел./факс: ${esc(phone)}</div>` : "";

  const requisitesParts: string[] = [];
  if (ogrn !== "") requisitesParts.push(`ОГРН ${esc(ogrn)}`);
  if (ogrnip !== "") requisitesParts.push(`ОГРНИП ${esc(ogrnip)}`);
  if (inn !== "") requisitesParts.push(`ИНН ${esc(inn)}`);
  if (kpp !== "") requisitesParts.push(`КПП ${esc(kpp)}`);
  const requisitesLine =
    requisitesParts.length > 0
      ? `<div>${requisitesParts.join(" • ")}</div>`
      : "";

  return `
<div style="
  width: 100%;
  font-family: 'Liberation Sans', 'DejaVu Sans', Arial, sans-serif;
  font-size: 8pt;
  color: #1c1c1c;
  text-align: center;
  padding: 0 4mm;
  border-top: 1px solid #4a4a4a;
  padding-top: 2mm;
">
  <div>${esc(companyName)} • ${esc(companyAddress)}</div>
  ${phoneLine}
  ${requisitesLine}
</div>`;
};

const HEADER_HTML = `<div></div>`;

export const KP_HEADER_TEMPLATE = HEADER_HTML;
