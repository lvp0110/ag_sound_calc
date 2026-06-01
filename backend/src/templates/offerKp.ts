import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogEntry } from "../services/catalogData.js";
import type { PriceLookup } from "../services/priceData.js";
import { constructionKpCardHeading } from "../utils/constructionKpDisplay.js";
import { formatDateRu } from "../utils/formatDateRu.js";
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
  ogrn: string | null;
  kpp: string | null;
  inn: string | null;
  services: ServiceLike[] | null;
  additional_materials: ServiceLike[] | null;
  constructions: ConstructionLike[];
};

export type RenderInput = {
  offer: OfferForRender;
  priceLookup: PriceLookup;
  catalog: Map<string, CatalogEntry>;
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
    const qtyM2 = Number(m.Quantity) / 1e6;
    if (!Number.isFinite(qtyM2)) return null;
    if (effM2 != null) return qtyM2 * effM2;
    if (effUnit != null) return qtyM2 * effUnit;
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
  if (isM2Units(m.Units)) {
    const q = Number(m.Quantity) / 1e6;
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

const materialDisplayName = (m: MaterialLike): string => {
  const name = typeof m.Name === "string" && m.Name.trim() !== ""
    ? m.Name.trim()
    : typeof m.name === "string" && m.name.trim() !== ""
      ? m.name.trim()
      : "";
  const article = materialArticle(m);
  if (article && name) return `${article}, ${name}`;
  return name || article || "—";
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

/**
 * Дефолтный «брендовый» блок шапки КП. Используется когда у оффера нет своего
 * логотипа или файл недоступен — сохраняет визуальную сетку шаблона.
 */
const DEFAULT_LOGO_BLOCK = `
  <div class="brand">ACOUSTIC GROUP</div>
  <div class="brand-sub">ПРОВЕРЕНО ИНЖЕНЕРАМИ<br/>ДОКАЗАНО ВРЕМЕНЕМ</div>`;

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/**
 * Собирает HTML для шапки КП. Если в оффере есть logo_url и файл существует —
 * вставляем картинку как data: URI (puppeteer рендерит без сети, локальные
 * пути или http-запросы внутри `setContent`-страницы ненадёжны). При любой
 * проблеме (нет URL, файл не читается, неподходящее расширение) — fallback
 * на дефолтный брендовый блок.
 */
const buildLogoBlockHtml = (logoUrl: string | null | undefined): string => {
  if (!logoUrl) return DEFAULT_LOGO_BLOCK;
  // Защита от path traversal — берём только basename. loadOfferDto уже
  // прогоняет verifyLogoFile, но шаблон может рендериться и в других кейсах.
  const filename = path.basename(logoUrl);
  const ext = path.extname(filename).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) return DEFAULT_LOGO_BLOCK;
  try {
    const buf = readFileSync(path.join(UPLOADS_DIR, filename));
    const b64 = buf.toString("base64");
    return `<img class="logo-img" src="data:${mime};base64,${b64}" alt="">`;
  } catch {
    return DEFAULT_LOGO_BLOCK;
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

export function renderOfferKpHtml({ offer, priceLookup, catalog }: RenderInput): string {
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

  // Правило: строка попадает в PDF, только если у неё цена > 0. Заголовок
  // секции рендерится только при наличии хотя бы одной строки. Без этого
  // пустые конструкции / нулевые услуги создают «висящие» секции в КП.
  const hasPositivePrice = (price: number | null | undefined): boolean =>
    price != null && Number.isFinite(price) && price > 0;

  type RenderedRow = RenderedSection["rows"][number];

  const pushPricedServiceRow = (
    rows: RenderedRow[],
    sectionTotal: { value: number },
    item: ServiceLike,
    fallbackName: string
  ): void => {
    const price = Number(item.price) || 0;
    if (!hasPositivePrice(price)) return;
    const count = Number(item.count) || 0;
    const lineSum = price * count;
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

  // Карточка конструкции на КП: материалы → монтаж → доп. материалы (в одной секции PDF).
  for (const c of constructionsOrdered) {
    const materials = orderMaterialsLikeKpTable(
      Array.isArray(c.materials) ? c.materials : []
    );
    const rows: RenderedRow[] = [];
    const sectionTotal = { value: 0 };

    for (const m of materials) {
      const article = materialArticle(m);
      const { pricePerM2, pricePerUnit } = priceLookup(article);
      const unitPrice = materialUnitPriceForDisplay(m, pricePerM2, pricePerUnit);
      if (!hasPositivePrice(unitPrice)) continue;
      const qty = materialQuantityForDisplay(m);
      const lineSum = materialLineSum(m, pricePerM2, pricePerUnit);
      if (lineSum != null) sectionTotal.value += lineSum;
      rows.push({
        name: materialDisplayName(m),
        unit: typeof m.Units === "string" ? m.Units : "—",
        qty,
        unitPrice,
        lineSum,
      });
    }

    const montageArr = Array.isArray(c.montage) ? c.montage : [];
    if (montageArr[0]) {
      pushPricedServiceRow(rows, sectionTotal, montageArr[0], "Монтаж");
    }

    for (const m of additionalByConstructionId.get(c.id) || []) {
      pushPricedServiceRow(rows, sectionTotal, m, "");
    }

    if (rows.length === 0) continue;
    sections.push({
      name: constructionKpCardHeading(c.calc_params, catalog),
      sectionTotal: sectionTotal.value,
      rows,
    });
  }

  // Услуги — оставляем только строки с положительной ценой.
  {
    const rows: RenderedSection["rows"] = [];
    let total = 0;
    for (const s of offer.services || []) {
      const price = Number(s.price) || 0;
      if (!hasPositivePrice(price)) continue;
      const count = Number(s.count) || 0;
      const lineSum = price * count;
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
        <td class="num">${sectionNo}</td>
        <td class="name" colspan="5"><strong>${esc(sec.name)}</strong></td>
        <td class="sum"><strong>${fmtRub(sec.sectionTotal)}</strong></td>
      </tr>`;
    sec.rows.forEach((row, rIdx) => {
      const itemNo = `${sectionNo}.${rIdx + 1}`;
      sectionsHtml += `
      <tr class="item-row">
        <td class="num">${esc(itemNo)}</td>
        <td class="name">${esc(row.name)}</td>
        <td class="lead"></td>
        <td class="unit">${esc(row.unit)}</td>
        <td class="qty">${esc(fmtQty(row.qty))}</td>
        <td class="price">${fmtRub(row.unitPrice)}</td>
        <td class="sum">${fmtRub(row.lineSum)}</td>
      </tr>`;
    });
  });

  const dateStr = formatDateRu(offer.kp_date);

  const placeholders: Record<string, string> = {
    TITLE: esc(offer.id),
    ISSUE_DATE: dateStr ? `от ${esc(dateStr)}` : "",
    OBJECT_NAME: esc(offer.object_name ?? ""),
    SECTIONS: sectionsHtml,
    NDS_AMOUNT: fmtRub(ndsAmount),
    GRAND_TOTAL: fmtRub(grandTotal),
    ITEMS_NOUN: esc(itemsNoun),
    ITEMS_COUNT: String(itemsCount),
    ITEMS_COUNT_WORDS: esc(itemsCountWordsCap),
    GRAND_TOTAL_WORDS: esc(grandWords),
    VALIDITY: dateStr ? "действует с даты КП" : "",
    MANAGER_NAME: esc(offer.manager_name ?? ""),
    MANAGER_EMAIL: esc(offer.email ?? ""),
    // HTML, не esc(): либо <img data: URI>, либо дефолтный брендовый блок.
    LOGO_BLOCK: buildLogoBlockHtml(offer.logo_url),
    // Название фирмы во вступительной фразе «Компания ООО «...» предлагает Вам».
    // В шаблоне «ООО «»» — обёртка зафиксирована, в плейсхолдер кладём только
    // «голое» название (как ввёл пользователь). При пустом поле — «Шуманет Шоп».
    INTRO_COMPANY: esc(
      (offer.company_name ?? "").trim() !== ""
        ? (offer.company_name as string).trim()
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
 * Дефолтные реквизиты для футера PDF (ООО «Шуманет Шоп»). Используются
 * по-полю, если соответствующее поле в Offer не заполнено — иначе подставится
 * значение из Offer (см. buildFooterHtml).
 */
const DEFAULT_FOOTER = {
  companyName: "ООО «Шуманет Шоп»",
  companyAddress: "115054, Москва г, Новокузнецкая ул, дом 33, строение 2",
  phone: "+8 (495) 134-98-98",
  ogrn: "1177746342157",
  kpp: "770501001",
  inn: "9705093593",
} as const;

/**
 * Футер PDF собирается на каждый рендер: пользовательские значения из Offer
 * (company_name / company_address / phone / ogrn / kpp / inn) подставляются
 * по-полю; пустые поля заменяются дефолтами «Шуманет Шоп».
 */
export const buildFooterHtml = (offer: OfferForRender): string => {
  const pick = (val: string | null | undefined, fallback: string): string => {
    const s = (val ?? "").trim();
    return s !== "" ? s : fallback;
  };
  const companyName = pick(offer.company_name, DEFAULT_FOOTER.companyName);
  const companyAddress = pick(offer.company_address, DEFAULT_FOOTER.companyAddress);
  const phone = pick(offer.phone, DEFAULT_FOOTER.phone);
  const ogrn = pick(offer.ogrn, DEFAULT_FOOTER.ogrn);
  const kpp = pick(offer.kpp, DEFAULT_FOOTER.kpp);
  const inn = pick(offer.inn, DEFAULT_FOOTER.inn);

  return `
<div style="
  width: 100%;
  font-family: 'Liberation Sans', 'DejaVu Sans', Arial, sans-serif;
  font-size: 8pt;
  color: #1c1c1c;
  text-align: center;
  padding: 0 12mm;
  border-top: 1px solid #4a4a4a;
  padding-top: 2mm;
">
  <div>${esc(companyName)} • ${esc(companyAddress)}</div>
  <div>Тел./факс: ${esc(phone)}</div>
  <div>ОГРН ${esc(ogrn)} • ИНН/КПП ${esc(inn)}/${esc(kpp)}</div>
</div>`;
};

const HEADER_HTML = `<div></div>`;

export const KP_HEADER_TEMPLATE = HEADER_HTML;
