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
}) {
  const constructions = constrToCalcToSent.map((calcParams, i) => ({
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
    },
  };
}

// ─── load ───────────────────────────────────────────────────────────────────

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
    return {
      key_id: c.id,
      title: meta.Name || code || "—",
      description: meta.Description || "",
      type: typeFromCode(code),
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
      montageByKeyId[c.id] = {
        price: first.price !== undefined && first.price !== null ? String(first.price) : "",
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
  };
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
  return {
    name: row.name || "",
    price,
    count,
    unit: row.unit || "",
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

function parseNumber(s) {
  if (typeof s === "number") return s;
  if (!s) return 0;
  const normalized = String(s).replace(/\s+/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function typeFromCode(code) {
  if (!code) return "";
  if (code.startsWith("AG.W")) return "Перегородка";
  if (code.startsWith("AG.C")) return "Потолок";
  if (code.startsWith("AG.F")) return "Пол";
  if (code.startsWith("AG.L")) return "Облицовка";
  return "";
}
