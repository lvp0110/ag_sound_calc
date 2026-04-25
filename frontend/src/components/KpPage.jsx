import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ConstructionList, {
  ConstructionGrandTotalBlock,
  computeTotalWeightKgForConstructions,
} from "./tables/ConstructionList";
import {
  computeGrandTotalRubForConstructions,
  formatRub,
  montageLineProductRub,
  parseKpDecimal,
} from "./tables/MaterialsList";
import { getOffer, updateOffer } from "../services/offersApi";
import {
  buildUpdateOfferPayload,
  mapOfferResponseToKpView,
} from "../utils/offerMapper";
import { getAllIsolationConstr } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";
import { setPriceRegion, usePriceData } from "../services/priceApi";
import "./Calculator.css";
import "./KpPage.css";


const initialForm = {
  manager: "",
  phone: "",
  email: "",
  officeAddress: "",
  region: "",
  date: "",
  object: "",
};

function formatServiceSum(product) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(product);
}

function serviceRowSum(priceStr, qtyStr) {
  const p = parseKpDecimal(priceStr);
  const q = parseKpDecimal(qtyStr);
  if (p === null || q === null) return "";
  return formatServiceSum(p * q);
}

/** Сумма монтажа по КП: отдельные цена×кол-во в каждой карточке (key_id). */
function montageGrandTotalRubForKp(constructions, montageByKeyId) {
  let sum = 0;
  for (const c of constructions) {
    const row = montageByKeyId[c.key_id];
    if (!row) continue;
    const p = parseKpDecimal(row.price);
    const q = parseKpDecimal(row.quantity);
    if (p !== null && q !== null) {
      sum += p * q;
    }
  }
  return sum;
}

/** Сумма блока «Услуги» (цена × количество по строкам). */
function additionalServicesGrandTotalRubForKp(serviceRows) {
  if (!Array.isArray(serviceRows)) return 0;
  let sum = 0;
  for (const row of serviceRows) {
    const p = parseKpDecimal(row.price);
    const q = parseKpDecimal(row.quantity);
    if (p !== null && q !== null) sum += p * q;
  }
  return sum;
}

/** Сумма блока «Дополнительные материалы» (цена × количество по строкам). */
function additionalMaterialsGrandTotalRubForKp(materialRows) {
  if (!Array.isArray(materialRows)) return 0;
  let sum = 0;
  for (const row of materialRows) {
    const p = parseKpDecimal(row.price);
    const q = parseKpDecimal(row.quantity);
    if (p !== null && q !== null) sum += p * q;
  }
  return sum;
}

function newCustomServiceRow() {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `svc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    preset: false,
    name: "",
    price: "",
    quantity: "",
    unit: "",
  };
}

function newCustomMaterialRow() {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `mat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    name: "",
    price: "",
    quantity: "",
    unit: "",
  };
}

const MONTAGE_ROW_LABEL = "Монтаж";

const INITIAL_SERVICE_ROWS = [
  {
    id: "delivery",
    preset: true,
    name: "Доставка",
    price: "",
    quantity: "",
    unit: "",
  },
];

const KP_SETTINGS_FIELDS = [
  { key: "floor", label: "Монтаж пола, р/за м2" },
  { key: "ceiling", label: "Монтаж потолка, р/за м2" },
  { key: "cladding", label: "Монтаж облицовки, р/за м2" },
  { key: "partition", label: "Монтаж перегородки, р/за м2" },
];

const REGION_SELECT_OPTIONS = [
  { value: "moscow", label: "Москва", regionKey: "msk" },
  { value: "saint-petersburg", label: "Санкт-Петербург", regionKey: "msk" },
  { value: "yekaterinburg", label: "Екатеринбург", regionKey: "ural" },
  { value: "ufa", label: "Уфа", regionKey: "ural" },
  { value: "krasnodar", label: "Краснодар", regionKey: "south" },
  { value: "kazan", label: "Казань", regionKey: "kazan" },
];

function parseConstructionNumber(value) {
  if (value == null || value === "") return NaN;
  const normalized = String(value).replace(",", ".").trim();
  const numericMatch = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!numericMatch) return NaN;
  const parsed = Number(numericMatch[0]);
  return Number.isNaN(parsed) ? NaN : parsed;
}

function constructionHeightMm({ lenY, lenZ }) {
  const z = lenZ != null && lenZ !== "" ? Number(lenZ) : NaN;
  if (!Number.isNaN(z) && z > 0) return lenZ;
  return lenY;
}

function constructionAreaM2(item) {
  const widthMm = parseConstructionNumber(item.lenX);
  const heightMm = parseConstructionNumber(constructionHeightMm(item));
  if (Number.isNaN(widthMm) || Number.isNaN(heightMm)) return NaN;
  if (widthMm <= 0 || heightMm <= 0) return NaN;
  return (widthMm * heightMm) / 1000000;
}

function formatMontageQuantity(areaM2) {
  if (Number.isNaN(areaM2)) return "";
  return areaM2.toFixed(4).replace(/\.?0+$/, "");
}

function kpSettingKeyByConstructionType(type) {
  const upperType = String(type ?? "").trim().toUpperCase();
  if (upperType === "ПОЛ") return "floor";
  if (upperType === "ПОТОЛОК") return "ceiling";
  if (upperType === "ОБЛИЦОВКА") return "cladding";
  if (upperType === "ПЕРЕГОРОДКА") return "partition";
  return null;
}

const KpPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthed, status: authStatus } = useAuth();
  const { regions, selectedRegion } = usePriceData();

  const [form, setForm] = useState(initialForm);
  const [calcTables, setCalcTables] = useState({
    tableConstrToCalc: null,
    ConstrToCalc: [],
    materialsByConstruction: [],
  });
  /** Монтаж по карточкам: key_id конструкции → { price, quantity, unit } */
  const [montageByKeyId, setMontageByKeyId] = useState(() => ({}));
  /** Раскрыт блок «Монтаж» в карточке (по key_id); по умолчанию свёрнут */
  const [montageSectionOpenByKeyId, setMontageSectionOpenByKeyId] = useState(
    () => ({}),
  );
  const [materialRows, setMaterialRows] = useState(() => [newCustomMaterialRow()]);
  const [serviceRows, setServiceRows] = useState(INITIAL_SERVICE_ROWS);
  // kpSettings — пользовательские настройки шифров по умолчанию для конструкций.
  // На main персистились в sessionStorage; в текущей offer-first архитектуре
  // ephemeral (сбрасываются при обновлении), миграция в Offer DTO — на будущее.
  const [kpSettings, setKpSettings] = useState({
    floor: "",
    ceiling: "",
    cladding: "",
    partition: "",
  });
  const [settingsSectionOpen, setSettingsSectionOpen] = useState(true);
  const [manualMontagePriceByKeyId, setManualMontagePriceByKeyId] = useState(
    () => ({})
  );
  const availableRegionKeys = useMemo(
    () => new Set(regions.map((region) => String(region).toLowerCase())),
    [regions]
  );
  const visibleRegionOptions = useMemo(
    () =>
      REGION_SELECT_OPTIONS.filter((option) =>
        availableRegionKeys.has(option.regionKey)
      ),
    [availableRegionKeys]
  );

  const [loadStatus, setLoadStatus] = useState("idle"); // 'idle'|'loading'|'loaded'|'error'|'forbidden'
  const [loadError, setLoadError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const originalConstructionsRef = useRef([]); // сырой Offer.constructions с calc_params — для PATCH

  // Загрузка оффера по :id (+ мапа Code→Name из AllIsolationConstr для карточек).
  useEffect(() => {
    if (!id) return undefined;
    if (authStatus === "loading") return undefined;
    if (!isAuthed) {
      // LoginModal не открываем автоматически (иначе всплывает после logout).
      // Просто рисуем экран-подсказку «войдите».
      setLoadStatus("forbidden");
      return undefined;
    }

    let cancelled = false;
    setLoadStatus("loading");
    setLoadError(null);

    (async () => {
      try {
        const [offer, constrList] = await Promise.all([
          getOffer(id),
          getAllIsolationConstr().catch(() => []),
        ]);
        if (cancelled) return;

        const titleByCode = new Map();
        for (const row of constrList || []) {
          if (row?.Code)
            titleByCode.set(row.Code, {
              Name: row.Name,
              Description: row.Description,
            });
        }

        const view = mapOfferResponseToKpView(offer, { titleByCode });
        originalConstructionsRef.current = offer.constructions || [];

        setForm(view.form);
        setCalcTables({
          tableConstrToCalc: view.constructions.length > 0 ? {} : null,
          ConstrToCalc: view.constructions,
          materialsByConstruction: view.materialsByConstruction,
        });
        setMontageByKeyId(view.montageByKeyId);
        setServiceRows(
          view.serviceRows.length > 0 ? view.serviceRows : INITIAL_SERVICE_ROWS,
        );
        // Доп. материалы хранятся независимо (offer.additional_materials).
        // Если пустой список — показываем одну пустую строку для удобства добавления.
        setMaterialRows(
          view.materialRows.length > 0
            ? view.materialRows
            : [newCustomMaterialRow()],
        );
        setLoadStatus("loaded");
      } catch (err) {
        if (cancelled) return;
        if (err?.status === 404) {
          setLoadStatus("error");
          setLoadError("Оффер не найден или принадлежит другому пользователю.");
        } else if (err?.status === 401) {
          setLoadStatus("forbidden");
        } else {
          setLoadStatus("error");
          setLoadError(err?.message || "Не удалось загрузить оффер.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isAuthed, authStatus]);

  // Авто-заполнение montage по kpSettings и площади конструкций (фича из main).
  // После загрузки оффера или ручной правки kpSettings/конструкций пересчитываем
  // строки монтажа. Если пользователь руками поправил цену — manualMontagePriceByKeyId
  // защищает её от перезаписи.
  useEffect(() => {
    const constructions = calcTables.ConstrToCalc;
    if (!Array.isArray(constructions) || constructions.length === 0) {
      return;
    }

    setMontageByKeyId((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const item of constructions) {
        const typeKey = kpSettingKeyByConstructionType(item.type);
        const montageRate = typeKey ? kpSettings[typeKey] ?? "" : "";
        const areaM2 = constructionAreaM2(item);
        const quantity = formatMontageQuantity(areaM2);
        const prevRow = prev[item.key_id];
        const keepManualPrice =
          manualMontagePriceByKeyId[item.key_id] === true &&
          prevRow &&
          typeof prevRow.price === "string" &&
          prevRow.price.trim() !== "";
        const normalizedRow = {
          price: keepManualPrice ? prevRow.price : montageRate,
          quantity,
          unit: "м2",
        };
        next[item.key_id] = normalizedRow;
        if (
          !prevRow ||
          prevRow.price !== normalizedRow.price ||
          prevRow.quantity !== normalizedRow.quantity ||
          prevRow.unit !== normalizedRow.unit
        ) {
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [calcTables.ConstrToCalc, kpSettings, manualMontagePriceByKeyId]);

  const updateMontagePriceRow = useCallback((key_id) => (e) => {
    const value = e.target.value;
    const isManual = value.trim() !== "";
    setManualMontagePriceByKeyId((prev) => {
      if (!isManual && !prev[key_id]) return prev;
      return { ...prev, [key_id]: isManual };
    });
    setMontageByKeyId((prev) => ({
      ...prev,
      [key_id]: {
        price: "",
        quantity: "",
        unit: "м2",
        ...prev[key_id],
        price: value,
      },
    }));
  }, []);

  const handleSave = async () => {
    if (!id || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const payload = buildUpdateOfferPayload({
        form,
        constructions: calcTables.ConstrToCalc,
        materialsByConstruction: calcTables.materialsByConstruction,
        montageByKeyId,
        serviceRows,
        materialRows,
        originalConstructionsFromOffer: originalConstructionsRef.current,
      });
      await updateOffer(id, payload);
      navigate("/kp/list");
    } catch (err) {
      setSaveError(err?.message || "Не удалось сохранить.");
    } finally {
      setIsSaving(false);
    }
  };

  const onGeneralMaterialKpPriceChange = useCallback(
    (key_id, indexInFullMaterialsData, field, value) => {
      setCalcTables((prev) => ({
        ...prev,
        materialsByConstruction: prev.materialsByConstruction.map((entry) => {
          if (entry.key_id !== key_id) return entry;
          const nextData = entry.data.map((row, i) =>
            i === indexInFullMaterialsData ? { ...row, [field]: value } : row,
          );
          return { ...entry, data: nextData };
        }),
      }));
    },
    [],
  );

  const onFieldChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const onRegionChange = (e) => {
    const optionValue = e.target.value;
    setForm((prev) => ({ ...prev, region: optionValue }));
    const selectedOption = REGION_SELECT_OPTIONS.find(
      (option) => option.value === optionValue
    );
    if (!selectedOption) return;
    setPriceRegion(selectedOption.regionKey);
  };

  useEffect(() => {
    if (!selectedRegion || form.region) return;
    const selectedRegionKey = String(selectedRegion).toLowerCase();
    const matchingOption = visibleRegionOptions.find(
      (option) => option.regionKey === selectedRegionKey
    );
    if (!matchingOption) return;
    setForm((prev) => ({ ...prev, region: matchingOption.value }));
  }, [form.region, selectedRegion, visibleRegionOptions]);

  const updateServiceRow = (id, field) => (e) => {
    const value = e.target.value;
    setServiceRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  };

  const addServiceRow = () => {
    setServiceRows((rows) => [...rows, newCustomServiceRow()]);
  };

  const removeServiceRow = (id) => {
    setServiceRows((rows) => rows.filter((r) => r.preset || r.id !== id));
  };

  const updateMaterialRow = (id, field) => (e) => {
    const value = e.target.value;
    setMaterialRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  };

  const autoResizeNameField = (e) => {
    const field = e.target;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  };

  useEffect(() => {
    const fields = document.querySelectorAll(".kp-page__services-textarea");
    fields.forEach((field) => {
      field.style.height = "auto";
      field.style.height = `${field.scrollHeight}px`;
    });
  }, [materialRows, serviceRows]);

  const addMaterialRow = () => {
    setMaterialRows((rows) => [...rows, newCustomMaterialRow()]);
  };

  const removeMaterialRow = (id) => {
    setMaterialRows((rows) => rows.filter((r) => r.id !== id));
  };

  const onKpSettingChange = (key) => (e) => {
    setKpSettings((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const toggleSettingsSection = () => {
    setSettingsSectionOpen((prev) => !prev);
  };

  const openPriceForMaterialSelection = () => {
    navigate("/price");
  };

  const updateMontageRow = useCallback(
    (key_id, field) => (e) => {
      const value = e.target.value;
      setMontageByKeyId((prev) => ({
        ...prev,
        [key_id]: {
          price: "",
          quantity: "",
          unit: "",
          ...prev[key_id],
          [field]: value,
        },
      }));
    },
    [],
  );

  const toggleMontageSection = useCallback((key_id) => {
    setMontageSectionOpenByKeyId((prev) => ({
      ...prev,
      [key_id]: !prev[key_id],
    }));
  }, []);

  const removeConstructionFromKp = useCallback((key_id) => {
    setCalcTables((prev) => ({
      ...prev,
      ConstrToCalc: prev.ConstrToCalc.filter((item) => item.key_id !== key_id),
      materialsByConstruction: prev.materialsByConstruction.filter(
        (entry) => entry.key_id !== key_id
      ),
    }));

    setMontageByKeyId((prev) => {
      if (!(key_id in prev)) return prev;
      const next = { ...prev };
      delete next[key_id];
      return next;
    });

    setMontageSectionOpenByKeyId((prev) => {
      if (!(key_id in prev)) return prev;
      const next = { ...prev };
      delete next[key_id];
      return next;
    });

    setManualMontagePriceByKeyId((prev) => {
      if (!(key_id in prev)) return prev;
      const next = { ...prev };
      delete next[key_id];
      return next;
    });
  }, []);

  const renderKpMontageSlot = useCallback(
    ({ key_id, cardIndex }) => {
      const row = montageByKeyId[key_id] ?? {
        price: "",
        quantity: "",
        unit: "",
      };
      const montageOpen = montageSectionOpenByKeyId[key_id] === true;
      return (
        <div className="tbl-in kp-page__montage-table-wrap">
          <button
            type="button"
            className="kp-section-collapsible-toggle"
            aria-expanded={montageOpen}
            onClick={() => toggleMontageSection(key_id)}
          >
            <span className="kp-collapsible-title-row">
              <span className="kp-collapsible-title-inner">
                <span
                  className={`kp-collapsible-chevron${
                    montageOpen ? " kp-collapsible-chevron--expanded" : ""
                  }`}
                  aria-hidden
                />
                <span>Монтаж</span>
              </span>
              <span className="kp-collapsible-title-sum" aria-hidden>
                {formatRub(montageLineProductRub(row))}
              </span>
            </span>
          </button>
          <table
            className="data kp-data-table--starts-with-column-headers"
            id={`kp-table-montage-${key_id}`}
            aria-label={`Монтаж, карточка ${cardIndex + 1}`}
            data-export-section-title="Монтаж"
            data-erp-data-start-row="1"
          >
            {montageOpen && (
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Цена</th>
                  <th>Количество</th>
                  <th>Ед. изм.</th>
                  <th>Сумма</th>
                </tr>
              </thead>
            )}
            {montageOpen && (
              <tbody>
                <tr>
                  <td className="kp-page__service-name-td--preset">
                    {MONTAGE_ROW_LABEL}
                  </td>
                  <td>
                    <input
                      id={`kp-montage-${key_id}-price`}
                      type="text"
                      className="kp-page__services-input"
                      value={row.price}
                      onChange={updateMontagePriceRow(key_id)}
                      aria-label={`Цена, ${MONTAGE_ROW_LABEL} (карточка ${cardIndex + 1}, из настроек КП)`}
                    />
                  </td>
                  <td>
                    <input
                      id={`kp-montage-${key_id}-quantity`}
                      type="text"
                      readOnly
                      className="kp-page__services-input"
                      value={row.quantity}
                      aria-label={`Количество, ${MONTAGE_ROW_LABEL} (карточка ${cardIndex + 1}, площадь конструкции)`}
                    />
                  </td>
                  <td>
                    <input
                      id={`kp-montage-${key_id}-unit`}
                      type="text"
                      readOnly
                      className="kp-page__services-input"
                      value={row.unit}
                      aria-label={`Единица измерения, ${MONTAGE_ROW_LABEL} (карточка ${cardIndex + 1})`}
                    />
                  </td>
                  <td>
                    <input
                      id={`kp-montage-${key_id}-sum`}
                      type="text"
                      readOnly
                      className="kp-page__services-input kp-page__services-input--computed"
                      value={serviceRowSum(row.price, row.quantity)}
                      aria-label={`Сумма, ${MONTAGE_ROW_LABEL} (карточка ${cardIndex + 1}, цена × количество)`}
                    />
                  </td>
                </tr>
              </tbody>
            )}
          </table>
        </div>
      );
    },
    [
      montageByKeyId,
      montageSectionOpenByKeyId,
      toggleMontageSection,
      updateMontagePriceRow,
      updateMontageRow,
    ],
  );

  if (loadStatus === "loading" || authStatus === "loading") {
    return (
      <div className="kp-page">
        <main className="kp-page__main">
          <p className="kp-page__tables-empty">Загрузка оффера...</p>
        </main>
      </div>
    );
  }

  if (loadStatus === "forbidden" || (!isAuthed && loadStatus !== "idle")) {
    return (
      <div className="kp-page">
        <main className="kp-page__main">
          <p className="kp-page__tables-empty">
            Войдите, чтобы открыть этот оффер.
          </p>
        </main>
      </div>
    );
  }

  if (loadStatus === "error") {
    return (
      <div className="kp-page">
        <main className="kp-page__main">
          <p className="kp-page__tables-empty">{loadError}</p>
          <button
            type="button"
            onClick={() => navigate("/kp/list")}
            className="add_design_button"
          >
            К списку КП
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="kp-page">
      <main className="kp-page__main">
        <h1 className="kp-page__title">Коммерческое предложение</h1>

        <section className="kp-page__contact" aria-label="Контактные данные">
          <div className="kp-page__field-row">
            <label className="kp-page__label" htmlFor="kp-date">
              Дата:
            </label>
            <input
              id="kp-date"
              className="kp-page__input"
              type="date"
              value={form.date}
              onChange={onFieldChange("date")}
            />
          </div>
          <div className="kp-page__field-row">
            <label className="kp-page__label" htmlFor="kp-region">
              Регион:
            </label>
            <select
              id="kp-region"
              className="kp-page__input kp-page__select"
              value={form.region}
              onChange={onRegionChange}
              aria-label="Регион прайса"
              disabled={visibleRegionOptions.length === 0}
            >
              {visibleRegionOptions.length === 0 ? (
                <option value="">Регионы не найдены</option>
              ) : (
                visibleRegionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="kp-page__field-row">
            <label className="kp-page__label" htmlFor="kp-object">
              Объект:
            </label>
            <input
              id="kp-object"
              className="kp-page__input"
              type="text"
              value={form.object}
              onChange={onFieldChange("object")}
            />
          </div>
          <div className="kp-page__field-row">
            <label className="kp-page__label" htmlFor="kp-manager">
              Менеджер:
            </label>
            <input
              id="kp-manager"
              className="kp-page__input"
              type="text"
              autoComplete="name"
              value={form.manager}
              onChange={onFieldChange("manager")}
            />
          </div>
          <div className="kp-page__field-row">
            <label className="kp-page__label" htmlFor="kp-phone">
              Телефон:
            </label>
            <input
              id="kp-phone"
              className="kp-page__input"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="+7 (___) ___-__-__"
              value={form.phone}
              onChange={onFieldChange("phone")}
            />
          </div>
          <div className="kp-page__field-row">
            <label className="kp-page__label" htmlFor="kp-email">
              Email:
            </label>
            <input
              id="kp-email"
              className="kp-page__input kp-page__input--email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={form.email}
              onChange={onFieldChange("email")}
            />
          </div>
          <div className="kp-page__field-row kp-page__field-row--last">
            <label className="kp-page__label" htmlFor="kp-address">
              Адрес офиса:
            </label>
            <input
              id="kp-address"
              className="kp-page__input"
              type="text"
              autoComplete="street-address"
              value={form.officeAddress}
              onChange={onFieldChange("officeAddress")}
            />
          </div>
        </section>

        <section className="kp-page__settings" aria-label="Настройки КП">
          <button
            type="button"
            className="kp-page__settings-toggle"
            aria-expanded={settingsSectionOpen}
            aria-controls="kp-settings-list"
            onClick={toggleSettingsSection}
          >
            <span className="kp-page__settings-title-row">
              <span className="kp-page__settings-title-inner">
                <span
                  className={`kp-collapsible-chevron${
                    settingsSectionOpen ? " kp-collapsible-chevron--expanded" : ""
                  }`}
                  aria-hidden
                />
                <span className="kp-page__settings-title">Настройки КП</span>
              </span>
            </span>
          </button>
          {settingsSectionOpen && (
            <ul id="kp-settings-list" className="kp-page__settings-list">
              {KP_SETTINGS_FIELDS.map((item) => (
                <li key={item.key} className="kp-page__settings-item">
                  <label
                    className="kp-page__settings-label"
                    htmlFor={`kp-setting-${item.key}`}
                  >
                    {item.label}
                  </label>
                  <input
                    id={`kp-setting-${item.key}`}
                    className="kp-page__settings-input"
                    type="number"
                    inputMode="numeric"
                    value={kpSettings[item.key]}
                    onChange={onKpSettingChange(item.key)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div
          className="tables-and-buttons-container kp-page__tables"
          aria-label="Данные расчёта из калькулятора"
        >
          {calcTables.tableConstrToCalc != null &&
          calcTables.ConstrToCalc.length > 0 ? (
            <>
              <ConstructionList
                constructions={calcTables.ConstrToCalc}
                readOnly
                showHeadingDeleteButton
                onDelete={removeConstructionFromKp}
                materialsByConstruction={calcTables.materialsByConstruction}
                renderKpMontageSlot={renderKpMontageSlot}
                montageByKeyId={montageByKeyId}
                showGrandTotalInline={false}
                onGeneralMaterialKpPriceChange={
                  onGeneralMaterialKpPriceChange
                }
              />
            </>
          ) : (
            <p className="kp-page__tables-empty">
              В этом КП пока нет конструкций. Перейдите в{" "}
              <button
                type="button"
                className="kp-page__link-btn"
                onClick={() => navigate("/calc")}
              >
                калькулятор
              </button>
              , чтобы добавить.
            </p>
          )}
        </div>

        <div className="kp-page__services">
          <div className="kp-table-card">
            <div className="tbl-in">
              <table
                className="data"
                id="kp-table-additional-materials"
                aria-label="Дополнительные материалы"
              >
                <colgroup>
                  <col style={{ width: "50%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "20%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th colSpan={5}>Дополнительные материалы</th>
                  </tr>
                  <tr>
                    <th>Название</th>
                    <th>Цена</th>
                    <th>Количество</th>
                    <th>Ед. изм.</th>
                    <th>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {materialRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="kp-page__service-name-cell">
                          <button
                            type="button"
                            className="kp-page__service-row-remove"
                            onClick={() => removeMaterialRow(row.id)}
                            aria-label="Удалить строку"
                          >
                            ×
                          </button>
                          <textarea
                            className="kp-page__services-input kp-page__services-textarea"
                            value={row.name}
                            onChange={updateMaterialRow(row.id, "name")}
                            onInput={autoResizeNameField}
                            aria-label="Название материала"
                            rows={1}
                          />
                        </div>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="kp-page__services-input"
                          value={row.price}
                          onChange={updateMaterialRow(row.id, "price")}
                          aria-label={`Цена, ${row.name || "материал"}`}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="kp-page__services-input"
                          value={row.quantity}
                          onChange={updateMaterialRow(row.id, "quantity")}
                          aria-label={`Количество, ${row.name || "материал"}`}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="kp-page__services-input"
                          value={row.unit}
                          onChange={updateMaterialRow(row.id, "unit")}
                          aria-label={`Единица измерения, ${row.name || "материал"}`}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          readOnly
                          className="kp-page__services-input kp-page__services-input--computed"
                          value={serviceRowSum(row.price, row.quantity)}
                          aria-label={`Сумма, ${row.name || "материал"} (цена × количество)`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="kp-page__services-add-row">
                    <td colSpan={5} className="kp-page__services-add-cell">
                      <button
                        type="button"
                        className="kp-page__services-add kp-page__services-add--secondary"
                        onClick={openPriceForMaterialSelection}
                      >
                        Выбрать материал из прайса
                      </button>
                    </td>
                  </tr>
                  <tr className="kp-page__services-add-row">
                    <td colSpan={5} className="kp-page__services-add-cell">
                      <button
                        type="button"
                        className="kp-page__services-add"
                        onClick={addMaterialRow}
                      >
                        Добавить строку
                      </button>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="kp-table-card">
            <div className="tbl-in">
              <table
                className="data"
                id="kp-table-services"
                aria-label="Дополнительные услуги"
              >
                <colgroup>
                  <col style={{ width: "60%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th colSpan={5}>Дополнительные услуги</th>
                  </tr>
                  <tr>
                    <th>Название</th>
                    <th>Цена</th>
                    <th>Количество</th>
                    <th>Ед. изм.</th>
                    <th>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceRows.map((row) => (
                    <tr key={row.id}>
                      <td
                        className={
                          row.preset
                            ? "kp-page__service-name-td--preset"
                            : undefined
                        }
                      >
                        {row.preset ? (
                          row.name
                        ) : (
                          <div className="kp-page__service-name-cell">
                            <button
                              type="button"
                              className="kp-page__service-row-remove"
                              onClick={() => removeServiceRow(row.id)}
                              aria-label="Удалить строку"
                            >
                              ×
                            </button>
                            <textarea
                              className="kp-page__services-input kp-page__services-textarea"
                              value={row.name}
                              onChange={updateServiceRow(row.id, "name")}
                              onInput={autoResizeNameField}
                              aria-label="Название услуги"
                              rows={1}
                            />
                          </div>
                        )}
                      </td>
                      <td>
                        <input
                          id={
                            row.preset
                              ? `kp-service-${row.id}-price`
                              : undefined
                          }
                          type="text"
                          className="kp-page__services-input"
                          value={row.price}
                          onChange={updateServiceRow(row.id, "price")}
                          aria-label={`Цена, ${row.name || "услуга"}`}
                        />
                      </td>
                      <td>
                        <input
                          id={
                            row.preset
                              ? `kp-service-${row.id}-quantity`
                              : undefined
                          }
                          type="text"
                          className="kp-page__services-input"
                          value={row.quantity}
                          onChange={updateServiceRow(row.id, "quantity")}
                          aria-label={`Количество, ${row.name || "услуга"}`}
                        />
                      </td>
                      <td>
                        <input
                          id={
                            row.preset ? `kp-service-${row.id}-unit` : undefined
                          }
                          type="text"
                          className="kp-page__services-input"
                          value={row.unit}
                          onChange={updateServiceRow(row.id, "unit")}
                          aria-label={`Единица измерения, ${row.name || "услуга"}`}
                        />
                      </td>
                      <td>
                        <input
                          id={`kp-service-${row.id}-sum`}
                          type="text"
                          readOnly
                          className="kp-page__services-input kp-page__services-input--computed"
                          value={serviceRowSum(row.price, row.quantity)}
                          aria-label={`Сумма, ${row.name || "услуга"} (цена × количество)`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="kp-page__services-add-row">
                    <td colSpan={5} className="kp-page__services-add-cell">
                      <button
                        type="button"
                        className="kp-page__services-add"
                        onClick={addServiceRow}
                      >
                        Добавить строку
                      </button>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {calcTables.tableConstrToCalc != null &&
          calcTables.ConstrToCalc.length > 0 && (
            <ConstructionGrandTotalBlock
              readOnly
              grandTotalRub={computeGrandTotalRubForConstructions(
                calcTables.ConstrToCalc,
                calcTables.materialsByConstruction,
              )}
              montageGrandTotalRub={montageGrandTotalRubForKp(
                calcTables.ConstrToCalc,
                montageByKeyId,
              )}
              additionalServicesGrandTotalRub={additionalServicesGrandTotalRubForKp(
                serviceRows,
              )}
              additionalMaterialsGrandTotalRub={additionalMaterialsGrandTotalRubForKp(
                materialRows
              )}
              totalWeightKg={computeTotalWeightKgForConstructions(
                calcTables.ConstrToCalc
              )}
              wrapClassName="kp-page__construction-grand-total"
            />
          )}

        <div className="kp-page__save-bar">
          {saveError && (
            <div className="kp-page__save-error" role="alert">
              {saveError}
            </div>
          )}
          <button
            type="button"
            className="add_design_button kp-page__save-btn"
            onClick={handleSave}
            disabled={isSaving || loadStatus !== "loaded"}
          >
            {isSaving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </main>
    </div>
  );
};

export default KpPage;
