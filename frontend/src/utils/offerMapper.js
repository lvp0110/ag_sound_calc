import {
  constructionTypeFromCalcParams,
  sectionIdFromCode,
} from "./constructionSection.js";

/**
 * Маппинг между состоянием Calculator / KpPage и бэкендовым DTO Offer.
 *
 * Поток:
 *   Calculator state → buildCreateOfferPayload() → POST /api/offers → Offer DTO
 *   GET /api/offers/:id → mapOfferResponseToKpView() → KpPage state
 *   KpPage state → buildUpdateOfferPayload() → PATCH /api/offers/:id
 */

// ─── create ─────────────────────────────────────────────────────────────────

/**
 * Собирает тело POST /api/offers из состояния калькулятора.
 * `form` необязателен — пользователь заполнит метаданные КП на /kp/:id.
 */
export function buildCreateOfferPayload({
  constrToCalcToSent,
  constrToCalc,
  form = null,
  services = [],
  kpSettings = null,
}) {
  const constructions = constrToCalcToSent.map((calcParams) => ({
    calc_params: calcParams,
    // materials серверная ручка пересчитает сама (POST всегда свежий calc),
    // montage пустой — пользователь заполнит на /kp/:id.
    montage: [],
    // сохраним UI-метаданные (title/type/ag_id/...) отдельным передачей
    // — см. buildUpdateOfferPayload. При создании они не нужны, бэк не хранит
    // этот блок на POST — на reload он реконструируется из AllIsolationConstr.
  }));

  void constrToCalc; // unused here — достаточно calc_params.Code для reload-а

  return {
    form: form ? mapFormToApi(form) : undefined,
    offerDraft: {
      constructions,
      services: services.map(mapServiceRowToApi).filter(Boolean),
      // доп. материалы при создании обычно пустые — пользователь добавит их на /kp/:id;
      // но если уже есть — сразу сохраним.
      additional_materials: [],
      ...(kpSettings ? { kp_settings: normalizeKpSettings(kpSettings) } : {}),
    },
  };
}

// ─── load ───────────────────────────────────────────────────────────────────

/** Обновляет title/description карточек после фоновой загрузки каталога. */
export function enrichConstructionsWithTitles(constructions, titleByCode) {
  if (!Array.isArray(constructions) || !(titleByCode instanceof Map)) {
    return constructions;
  }
  return constructions.map((item) => {
    const code = item?.ag_id || "";
    const meta = titleByCode.get(code) || {};
    const nextTitle = meta.Name || item.title || code || "—";
    const nextDescription = meta.Description ?? item.description ?? "";
    if (item.title === nextTitle && item.description === nextDescription) {
      return item;
    }
    return {
      ...item,
      title: nextTitle,
      description: nextDescription,
    };
  });
}

/**
 * Превращает ответ GET /api/offers/:id в объекты, которые потребляет KpPage:
 *   - form          — плоская модель контактной формы (даты/регион/менеджер/...).
 *   - constructions — ConstrToCalc-совместимый массив карточек (key_id === construction.id).
 *   - materialsByConstruction — [{ key_id, data: Material[] }] в той же форме,
 *                               что писал Calculator (KpPricePerM2/KpPricePerUnit
 *                               уже наложены backend'ом как override'ы).
 *   - montageByKeyId — { [key_id]: { price, quantity, unit } }.
 *   - serviceRows   — [{ id, preset, name, price, quantity, unit }].
 *   - materialRows  — дополнительные материалы (хранятся в offer.additional_materials,
 *                     независимо от расчётов — backend их не пересчитывает).
 *
 * `titleByCode` — опциональная мапа Code → {Name, Description} (результат
 * getAllIsolationConstr). Если не передать — карточка покажет Code как title.
 */
export function mapOfferResponseToKpView(offer, { titleByCode = new Map() } = {}) {
  const constructions = (offer.constructions || []).map((c) => {
    const cp = c.calc_params || {};
    const code = cp.Code || "";
    const meta = titleByCode.get(code) || {};
    const sectionId = cp.SectionId || sectionIdFromCode(code);
    return {
      key_id: c.id,
      title: meta.Name || code || "—",
      description: meta.Description || "",
      type: constructionTypeFromCalcParams(cp),
      section_id: sectionId,
      ag_id: code,
      step: Number(cp.step) || 600,
      weight: null,
      imgBlack: null,
      lenX: Number(cp.LenX) || 0,
      lenY: Number(cp.LenY) || 0,
      lenZ: Number(cp.LenZ) || 0,
      AddCeilShift: Number(cp.AddCeilShift) || 0,
    };
  });

  const materialsByConstruction = (offer.constructions || []).map((c) => ({
    key_id: c.id,
    data: Array.isArray(c.materials) ? c.materials : [],
  }));

  const montageByKeyId = {};
  for (const c of offer.constructions || []) {
    const montageArr = Array.isArray(c.montage) ? c.montage : [];
    // Мы храним на бэке весь массив Service[], но UI в карточке поддерживает
    // одну строку «Монтаж» → берём первую.
    const first = montageArr[0];
    if (first) {
      // price === 0 (или null/undefined) трактуем как «не задано» — на бэк
      // пустое поле уходит как parseNumber("") === 0, и при следующей загрузке
      // мы должны заново подставить ставку из kpSettings, а не показать "0".
      const rawPrice = first.price;
      const price =
        rawPrice == null || Number(rawPrice) === 0 ? "" : String(rawPrice);
      montageByKeyId[c.id] = {
        price,
        quantity:
          first.count !== undefined && first.count !== null ? String(first.count) : "",
        unit: first.unit || "",
      };
    }
  }

  return {
    form: mapApiToForm(offer),
    constructions,
    materialsByConstruction,
    montageByKeyId,
    serviceRows: mapServicesToRows(offer.services),
    materialRows: mapAdditionalMaterialsToRows(offer.additional_materials),
    kpSettings: mapKpSettingsFromApi(offer.kp_settings),
  };
}

/**
 * Состояние калькулятора из GET /api/offers/:id (режим редактирования черновика КП).
 */
export function mapOfferToCalculatorState(offer, options) {
  const view = mapOfferResponseToKpView(offer, options);
  const constrToCalcToSent = (offer.constructions || [])
    .map((c) => c.calc_params)
    .filter(Boolean);
  return {
    constrToCalc: view.constructions,
    constrToCalcToSent,
    materialsByConstruction: view.materialsByConstruction,
    tableConstrToCalc: view.constructions.length > 0 ? {} : null,
  };
}

// ─── draft sync (калькулятор → черновик КП без финального «Сохранить») ───────

/**
 * PATCH при «Вернуться в КП»: конструкции из калькулятора + форма/услуги/доп. материалы
 * из kpSnapshot (несохранённые правки на странице КП).
 */
export function buildDraftSyncFromCalculator({
  constrToCalcToSent,
  materialsByConstruction,
  kpSnapshot = null,
}) {
  const snapshotKpSettings = kpSnapshot?.kpSettings;
  const oldKeyIds = kpSnapshot?.calcTables?.ConstrToCalc?.map((c) => c.key_id) || [];
  const montageByKeyId = kpSnapshot?.montageByKeyId || {};

  const constructions = (constrToCalcToSent || []).map((calcParams, i) => {
    const materials = materialsByConstruction?.[i]?.data || [];
    const legacyKeyId = oldKeyIds[i];
    const montageRow = legacyKeyId ? montageByKeyId[legacyKeyId] : null;
    const montage = montageRow
      ? [
          {
            name: "Монтаж",
            price: parseNumber(montageRow.price),
            count: parseNumber(montageRow.quantity),
            unit: montageRow.unit || "",
          },
        ]
      : [];
    return { calc_params: calcParams, materials, montage };
  });

  const payload = { constructions };

  if (kpSnapshot?.form) {
    payload.form = mapFormToApi(kpSnapshot.form);
  }
  if (kpSnapshot?.serviceRows) {
    payload.services = kpSnapshot.serviceRows.map(mapServiceRowToApi).filter(Boolean);
  }
  if (kpSnapshot?.materialRows) {
    payload.additional_materials = kpSnapshot.materialRows
      .map(mapMaterialRowToApi)
      .filter(Boolean);
  }
  if (snapshotKpSettings) {
    payload.kp_settings = normalizeKpSettings(snapshotKpSettings);
  }

  return payload;
}

// ─── update ─────────────────────────────────────────────────────────────────

/**
 * Собирает тело PATCH /api/offers/:id из текущего состояния KpPage.
 * Отправляем весь снимок (form + services + constructions со всеми материалами и монтажом),
 * backend заменяет конструкции атомарно.
 */
export function buildUpdateOfferPayload({
  form,
  constructions,              // UI-метаданные (ConstrToCalc-shaped)
  materialsByConstruction,    // [{ key_id, data }]
  montageByKeyId,             // { key_id: { price, quantity, unit } }
  serviceRows,                // [{ id, preset, name, price, quantity, unit }]
  materialRows,               // [{ id, name, price, quantity, unit }] — доп. материалы
  kpSettings = null,          // { floor, ceiling, cladding, partition } | null
  originalConstructionsFromOffer, // Offer.constructions из getOffer — чтобы достать calc_params
}) {
  const calcParamsById = new Map(
    (originalConstructionsFromOffer || []).map((c) => [c.id, c.calc_params])
  );

  const constructionsPayload = (constructions || []).map((ui) => {
    const calcParams = calcParamsById.get(ui.key_id);
    const materials =
      materialsByConstruction.find((m) => m.key_id === ui.key_id)?.data || [];
    const montageRow = montageByKeyId?.[ui.key_id];
    const montage = montageRow
      ? [
          {
            name: "Монтаж",
            price: parseNumber(montageRow.price),
            count: parseNumber(montageRow.quantity),
            unit: montageRow.unit || "",
          },
        ]
      : [];
    return {
      calc_params: calcParams,
      materials,
      montage,
    };
  });

  return {
    form: form ? mapFormToApi(form) : undefined,
    services: (serviceRows || []).map(mapServiceRowToApi).filter(Boolean),
    additional_materials: (materialRows || [])
      .map(mapMaterialRowToApi)
      .filter(Boolean),
    kp_settings: kpSettings ? normalizeKpSettings(kpSettings) : null,
    constructions: constructionsPayload,
  };
}

// ─── helpers ────────────────────────────────────────────────────────────────

function mapFormToApi(form) {
  return {
    manager_name: form.manager || null,
    phone: form.phone || null,
    email: form.email || null,
    office_address: form.officeAddress || null,
    region: form.region || null,
    kp_date: form.date || null,
    object_name: form.object || null,
    // logoUrl на фронте — относительный путь вида `/uploads/<filename>` (см.
    // backend/src/routes/uploads.ts). null = логотип не выбран / удалён.
    logo_url: form.logoUrl || null,
  };
}

function mapApiToForm(offer) {
  return {
    manager: offer.manager_name || "",
    phone: offer.phone || "",
    email: offer.email || "",
    officeAddress: offer.office_address || "",
    region: offer.region || "",
    date: offer.kp_date || "",
    object: offer.object_name || "",
    logoUrl: offer.logo_url || "",
  };
}

function mapServiceRowToApi(row) {
  if (!row) return null;
  const price = parseNumber(row.price);
  const count = parseNumber(row.quantity);
  // пустые и без названия строки не сохраняем
  if (!row.name && price === 0 && count === 0) return null;
  return {
    name: row.name || "",
    price,
    count,
    unit: row.unit || "",
  };
}

/**
 * UI-строка доп. материала → API-формат (одинаковый с Service).
 * Пустые строки (без имени, цены и количества) не сохраняем.
 */
function mapMaterialRowToApi(row) {
  if (!row) return null;
  const price = parseNumber(row.price);
  const count = parseNumber(row.quantity);
  if (!row.name && price === 0 && count === 0) return null;
  const article = String(row.sourceArticle ?? "").trim();
  return {
    name: row.name || "",
    price,
    count,
    unit: row.unit || "",
    ...(article ? { source_article: article } : {}),
  };
}

/**
 * additional_materials из ответа API → строки для KpPage.materialRows.
 * Если список пуст — возвращаем одну пустую строку для удобства добавления.
 */
function mapAdditionalMaterialsToRows(additionalMaterials) {
  const arr = Array.isArray(additionalMaterials) ? additionalMaterials : [];
  if (arr.length === 0) return [];
  return arr.map((m, i) => ({
    id:
      m.id ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `mat-${i}-${Date.now()}`),
    name: m.name || "",
    price: m.price !== undefined && m.price !== null ? String(m.price) : "",
    quantity: m.count !== undefined && m.count !== null ? String(m.count) : "",
    unit: m.unit || "",
    sourceArticle: m.source_article ? String(m.source_article) : "",
  }));
}

function mapServicesToRows(services) {
  const rows = (Array.isArray(services) ? services : []).map((s, i) => ({
    id: s.id || `svc-${i}-${Date.now()}`,
    preset: s.name === "Доставка",
    name: s.name || "",
    price: s.price !== undefined && s.price !== null ? String(s.price) : "",
    quantity: s.count !== undefined && s.count !== null ? String(s.count) : "",
    unit: s.unit || "",
  }));
  // всегда должна быть строка Доставка (preset), даже если её нет в ответе
  if (!rows.some((r) => r.preset)) {
    rows.unshift({
      id: "delivery",
      preset: true,
      name: "Доставка",
      price: "",
      quantity: "",
      unit: "",
    });
  }
  return rows;
}

const KP_SETTINGS_KEYS = ["floor", "ceiling", "cladding", "partition"];

/**
 * Нормализуем kpSettings перед отправкой: на фронте поля хранятся строками
 * (значение <input type="number">) — кладём их в payload как есть, отсутствующие
 * поля заполняем пустой строкой. Backend хранит JSON «как есть».
 */
function normalizeKpSettings(kpSettings) {
  if (!kpSettings || typeof kpSettings !== "object") return null;
  const out = {};
  for (const key of KP_SETTINGS_KEYS) {
    const value = kpSettings[key];
    out[key] = value === undefined || value === null ? "" : String(value);
  }
  return out;
}

/**
 * kp_settings из ответа API → состояние KpPage (строки для контролируемых
 * input'ов). Если поле отсутствует, ставим "" — чтобы input был controlled.
 */
function mapKpSettingsFromApi(apiKpSettings) {
  const src =
    apiKpSettings && typeof apiKpSettings === "object" ? apiKpSettings : {};
  const out = {};
  for (const key of KP_SETTINGS_KEYS) {
    const value = src[key];
    out[key] = value === undefined || value === null ? "" : String(value);
  }
  return out;
}

function parseNumber(s) {
  if (typeof s === "number") return s;
  if (!s) return 0;
  const normalized = String(s).replace(/\s+/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

