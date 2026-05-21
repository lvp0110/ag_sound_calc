import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ConstructionList, {
  ConstructionGrandTotalBlock,
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
  enrichConstructionsWithTitles,
  mapOfferResponseToKpView,
} from "../utils/offerMapper";
import {
  buildTitleByCodeMap,
  getAllIsolationConstr,
} from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";
import {
  REGION_SELECT_OPTIONS,
  filterVisibleRegionOptions,
  findRegionOptionByRegionKey,
  findRegionOptionByValue,
} from "../constants/regionSelectOptions.js";
import { setPriceRegion, usePriceData } from "../services/priceApi";
import {
  useOfferEditSession,
  useOfferEditSessionStore,
} from "../stores/offerEditSessionStore.js";
import { useCalculatorStore } from "../stores/calculatorStore.js";
import { KpNarrowExpandableRow } from "./kp/KpNarrowExpandableRow";
import { useKpExpandedRow } from "../hooks/useKpExpandedRow";
import { useKpNarrowViewport } from "../hooks/useKpNarrowViewport";
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

/** Все обязательные поля блока «Контактные данные» (.kp-page__contact) заполнены. */
function isKpContactFormComplete(form) {
  if (!form) return false;
  return [
    form.date,
    form.region,
    form.object,
    form.manager,
    form.phone,
    form.email,
    form.officeAddress,
  ].every((v) => String(v ?? "").trim() !== "");
}

function formatServiceSum(product) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(product);
}

const KP_DECIMAL_PLACEHOLDER = "0,00";

const KP_AUTO_RESIZE_TEXTAREA_SELECTOR =
  ".kp-page__services-textarea, .kp-page__contact textarea.kp-page__input";

function syncTextareaHeight(field) {
  if (!field || field.nodeName !== "TEXTAREA") return;
  field.style.height = "auto";
  field.style.height = `${field.scrollHeight}px`;
}

function serviceRowSum(priceStr, qtyStr) {
  const p = parseKpDecimal(priceStr);
  const q = parseKpDecimal(qtyStr);
  if (p === null || q === null) return KP_DECIMAL_PLACEHOLDER;
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

function KpCollapsibleExtraTable({
  tableId,
  ariaLabel,
  title,
  sectionOpen,
  onToggleSection,
  totalRub,
  colgroup,
  children,
  footerRows,
}) {
  return (
    <div className="kp-table-card">
      <button
        type="button"
        className="kp-section-collapsible-toggle"
        aria-expanded={sectionOpen}
        aria-controls={tableId}
        onClick={onToggleSection}
      >
        <span className="kp-collapsible-title-row">
          <span className="kp-collapsible-title-inner">
            <span
              className={`kp-collapsible-chevron${
                sectionOpen ? " kp-collapsible-chevron--expanded" : ""
              }`}
              aria-hidden
            />
            <span>{title}</span>
          </span>
          <span className="kp-collapsible-title-sum" aria-hidden>
            {formatRub(totalRub ?? 0)}
          </span>
        </span>
      </button>
      <div className="tbl-in">
        <table
          className="data kp-data-table--starts-with-column-headers"
          id={tableId}
          aria-label={ariaLabel}
          data-export-section-title={title}
          data-erp-data-start-row="1"
        >
          {colgroup}
          {sectionOpen && (
            <>
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Цена</th>
                  <th>Количество</th>
                  <th>Ед. изм.</th>
                  <th>Сумма</th>
                </tr>
              </thead>
              <tbody>{children}</tbody>
              <tfoot>
                {footerRows}
                <tr className="kp-page__section-total-row">
                  <td colSpan={5} className="kp-page__section-total-cell">
                    <div className="kp-card-sections-total__inner">
                      <span className="kp-card-sections-total__label">
                        Итого
                      </span>
                      <span className="kp-card-sections-total__amount">
                        {formatRub(totalRub)}
                      </span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </>
          )}
        </table>
      </div>
    </div>
  );
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
  const upperType = String(type ?? "")
    .trim()
    .toUpperCase();
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
  const { regions, selectedRegion, loaded: priceLoaded, loading: priceLoading, error: priceError } =
    usePriceData();
  const {
    isEditingDraft,
    activeOfferId,
    kpSnapshot,
    startDraft,
    stashKpSnapshot,
    clearSession,
    setSelectedPriceArticles,
  } = useOfferEditSession();

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
  const [materialRows, setMaterialRows] = useState(() => [
    newCustomMaterialRow(),
  ]);
  const [serviceRows, setServiceRows] = useState(INITIAL_SERVICE_ROWS);
  // kpSettings — пользовательские ставки монтажа по типам конструкций. Хранятся
  // в Offer.kp_settings (JSONB), приходят в DTO под ключом `kp_settings`.
  // Снимок отдаётся через useOfferEditSession при возврате из калькулятора, чтобы
  // не сбрасывать локальные правки до сохранения.
  const [kpSettings, setKpSettings] = useState({
    floor: "",
    ceiling: "",
    cladding: "",
    partition: "",
  });
  const [settingsSectionOpen, setSettingsSectionOpen] = useState(false);
  const [additionalMaterialsSectionOpen, setAdditionalMaterialsSectionOpen] =
    useState(false);
  const [servicesSectionOpen, setServicesSectionOpen] = useState(false);
  const isKpNarrow = useKpNarrowViewport();
  const { expandedKey, toggleRow } = useKpExpandedRow();
  const [manualMontagePriceByKeyId, setManualMontagePriceByKeyId] = useState(
    () => ({}),
  );
  const visibleRegionOptions = useMemo(
    () => filterVisibleRegionOptions(regions),
    [regions]
  );
  const isPriceRegionsLoading = priceLoading || (!priceLoaded && !priceError);
  const additionalMaterialsTotalRub = useMemo(
    () => additionalMaterialsGrandTotalRubForKp(materialRows),
    [materialRows],
  );
  const servicesTotalRub = useMemo(
    () => additionalServicesGrandTotalRubForKp(serviceRows),
    [serviceRows],
  );

  const [loadStatus, setLoadStatus] = useState("idle"); // 'idle'|'loading'|'loaded'|'error'|'forbidden'
  const [loadError, setLoadError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const originalConstructionsRef = useRef([]); // сырой Offer.constructions с calc_params — для PATCH

  // Загрузка оффера по :id. Каталог AllIsolationConstr — отдельно (может быть 25–35s).
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
    setSettingsSectionOpen(false);
    setAdditionalMaterialsSectionOpen(false);
    setServicesSectionOpen(false);
    setLoadStatus("loading");
    setLoadError(null);

    (async () => {
      try {
        const offer = await getOffer(id);
        if (cancelled) return;

        const view = mapOfferResponseToKpView(offer);
        originalConstructionsRef.current = offer.constructions || [];

        const snap = kpSnapshot && activeOfferId === id ? kpSnapshot : null;

        setForm(snap?.form ?? view.form);
        // Сессия калькулятора/КП живёт в kpSnapshot — иначе после удаления
        // в калькуляторе GET снова подставляет старый состав до PATCH.
        setCalcTables(
          snap?.calcTables
            ? snap.calcTables
            : {
                tableConstrToCalc: view.constructions.length > 0 ? {} : null,
                ConstrToCalc: view.constructions,
                materialsByConstruction: view.materialsByConstruction,
              },
        );
        setMontageByKeyId(snap?.montageByKeyId ?? view.montageByKeyId);
        setServiceRows(
          snap?.serviceRows ??
            (view.serviceRows.length > 0
              ? view.serviceRows
              : INITIAL_SERVICE_ROWS),
        );
        setMaterialRows(
          snap?.materialRows ??
            (view.materialRows.length > 0
              ? view.materialRows
              : [newCustomMaterialRow()]),
        );
        if (snap?.kpSettings) {
          setKpSettings(snap.kpSettings);
        } else if (view.kpSettings) {
          setKpSettings(view.kpSettings);
        }
        if (snap?.manualMontagePriceByKeyId) {
          setManualMontagePriceByKeyId(snap.manualMontagePriceByKeyId);
        } else {
          // Цена монтажа из БД (c.montage[0].price) приоритетнее ставки из
          // настроек КП: помечаем такие key_id как «ручные», иначе авто-эффект
          // ниже перезатрёт их значением из kpSettings.
          const initialManual = {};
          for (const [keyId, row] of Object.entries(view.montageByKeyId)) {
            if (
              row &&
              typeof row.price === "string" &&
              row.price.trim() !== ""
            ) {
              initialManual[keyId] = true;
            }
          }
          setManualMontagePriceByKeyId(initialManual);
        }
        const rowsForArticles = snap?.materialRows ?? view.materialRows;
        const articles = rowsForArticles
          .map((r) => String(r.sourceArticle ?? "").trim())
          .filter(Boolean);
        if (articles.length) setSelectedPriceArticles(articles);

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
  }, [
    id,
    isAuthed,
    authStatus,
    kpSnapshot,
    activeOfferId,
    setSelectedPriceArticles,
  ]);

  // Подписи карточек из каталога — не блокируем первый рендер КП.
  useEffect(() => {
    if (!id || loadStatus !== "loaded") return undefined;
    if (kpSnapshot && activeOfferId === id) return undefined;

    let cancelled = false;
    getAllIsolationConstr()
      .then((constrList) => {
        if (cancelled) return;
        const titleByCode = buildTitleByCodeMap(constrList);
        setCalcTables((prev) => {
          if (!prev?.ConstrToCalc?.length) return prev;
          return {
            ...prev,
            ConstrToCalc: enrichConstructionsWithTitles(
              prev.ConstrToCalc,
              titleByCode,
            ),
          };
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [id, loadStatus, kpSnapshot, activeOfferId]);

  // Режим черновика: КП «открыто» до «Сохранить», навигация только на /calc и /price.
  useEffect(() => {
    if (loadStatus === "loaded" && id && isAuthed) {
      startDraft(id);
    }
  }, [loadStatus, id, isAuthed, startDraft]);

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
        const montageRate = typeKey ? (kpSettings[typeKey] ?? "") : "";
        const areaM2 = constructionAreaM2(item);
        const quantity = formatMontageQuantity(areaM2);
        const prevRow = prev[item.key_id];
        // «Ручная» цена закрепляется за пользователем целиком — в т.ч. пустое
        // значение (пользователь явно очистил поле): подставлять ставку из
        // kpSettings можно только если флаг manualMontagePriceByKeyId не взведён.
        const keepManualPrice =
          manualMontagePriceByKeyId[item.key_id] === true && prevRow;
        const normalizedRow = {
          price: keepManualPrice ? (prevRow.price ?? "") : montageRate,
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

  const updateMontagePriceRow = useCallback(
    (key_id) => (e) => {
      const value = e.target.value;
      // Любое касание поля (в т.ч. полная очистка) «закрепляет» цену за
      // пользователем: после этого авто-эффект не подставит ставку из kpSettings.
      setManualMontagePriceByKeyId((prev) => {
        if (prev[key_id] === true) return prev;
        return { ...prev, [key_id]: true };
      });
      setMontageByKeyId((prev) => ({
        ...prev,
        [key_id]: {
          unit: "м2",
          ...prev[key_id],
          price: value,
        },
      }));
    },
    [],
  );

  const handleSave = async () => {
    if (!id || isSaving) return;
    if (!isKpContactFormComplete(form)) {
      setSaveError(
        "Заполните все поля в блоке «Контактные данные» (дата, регион, объект, менеджер, телефон, email, адрес офиса).",
      );
      return;
    }
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
        kpSettings,
        originalConstructionsFromOffer: originalConstructionsRef.current,
      });
      await updateOffer(id, payload);
      clearSession();
      useCalculatorStore.getState().reset();
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
      (option) => option.value === optionValue,
    );
    if (!selectedOption) return;
    setPriceRegion(selectedOption.regionKey, { cityValue: optionValue });
  };

  useEffect(() => {
    if (!form.region || loadStatus !== "loaded" || !priceLoaded) return;
    const selectedOption =
      findRegionOptionByValue(form.region) ??
      findRegionOptionByRegionKey(form.region);
    if (!selectedOption) return;
    setPriceRegion(selectedOption.regionKey, { cityValue: selectedOption.value });
  }, [form.region, loadStatus, priceLoaded]);

  useEffect(() => {
    if (!selectedRegion || form.region) return;
    const selectedRegionKey = String(selectedRegion).toLowerCase();
    const matchingOption = visibleRegionOptions.find(
      (option) => option.regionKey === selectedRegionKey,
    );
    if (!matchingOption) return;
    setForm((prev) => ({ ...prev, region: matchingOption.value }));
    setPriceRegion(matchingOption.regionKey, {
      cityValue: matchingOption.value,
    });
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
    syncTextareaHeight(e.target);
  };

  const onContactFieldChange = (key) => (e) => {
    onFieldChange(key)(e);
    autoResizeNameField(e);
  };

  useEffect(() => {
    const syncAll = () => {
      requestAnimationFrame(() => {
        document
          .querySelectorAll(KP_AUTO_RESIZE_TEXTAREA_SELECTOR)
          .forEach(syncTextareaHeight);
      });
    };

    syncAll();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const { target } of entries) {
        syncTextareaHeight(target);
      }
    });

    const fields = document.querySelectorAll(KP_AUTO_RESIZE_TEXTAREA_SELECTOR);
    fields.forEach((field) => resizeObserver.observe(field));

    window.addEventListener("resize", syncAll);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", syncAll);
    };
  }, [
    materialRows,
    serviceRows,
    loadStatus,
    isKpNarrow,
    expandedKey,
    form.object,
    form.manager,
    form.phone,
    form.email,
    form.officeAddress,
  ]);

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

  const stashAndLeaveKp = useCallback(() => {
    const calcParamsById = new Map(
      (originalConstructionsRef.current || []).map((c) => [
        c.id,
        c.calc_params,
      ]),
    );
    const constrToCalcToSent = (calcTables.ConstrToCalc || [])
      .map((ui) => calcParamsById.get(ui.key_id))
      .filter(Boolean);

    stashKpSnapshot({
      form,
      calcTables,
      constrToCalcToSent,
      montageByKeyId,
      serviceRows,
      materialRows,
      manualMontagePriceByKeyId,
      kpSettings,
    });
  }, [
    stashKpSnapshot,
    form,
    calcTables,
    montageByKeyId,
    serviceRows,
    materialRows,
    manualMontagePriceByKeyId,
    kpSettings,
  ]);

  const openPriceForMaterialSelection = () => {
    const articles = materialRows
      .map((r) => String(r.sourceArticle ?? "").trim())
      .filter(Boolean);
    if (articles.length) setSelectedPriceArticles(articles);
    stashAndLeaveKp();
    navigate("/price");
  };

  const openCalculatorForConstructions = () => {
    stashAndLeaveKp();
    navigate("/calc");
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
    setCalcTables((prev) => {
      const nextConstr = prev.ConstrToCalc.filter(
        (item) => item.key_id !== key_id,
      );
      const nextMaterials = prev.materialsByConstruction.filter(
        (entry) => entry.key_id !== key_id,
      );
      const next = {
        ...prev,
        ConstrToCalc: nextConstr,
        materialsByConstruction: nextMaterials,
      };

      const calcParamsById = new Map(
        (originalConstructionsRef.current || []).map((c) => [c.id, c.calc_params]),
      );
      const constrToCalcToSent = nextConstr
        .map((ui) => calcParamsById.get(ui.key_id))
        .filter(Boolean);

      const { setField } = useCalculatorStore.getState();
      setField("ConstrToCalc", nextConstr);
      setField("materialsByConstruction", nextMaterials);
      setField("ConstrToCalcToSent", constrToCalcToSent);
      if (nextConstr.length === 0) {
        setField("tableConstrToCalc", null);
      }

      const sess = useOfferEditSessionStore.getState();
      if (sess.activeOfferId === id) {
        const prevSnap = sess.kpSnapshot || {};
        const patch = {
          ...prevSnap,
          calcTables: next,
          constrToCalcToSent,
        };
        if (prevSnap.montageByKeyId) {
          const m = { ...prevSnap.montageByKeyId };
          delete m[key_id];
          patch.montageByKeyId = m;
        }
        if (prevSnap.manualMontagePriceByKeyId) {
          const m = { ...prevSnap.manualMontagePriceByKeyId };
          delete m[key_id];
          patch.manualMontagePriceByKeyId = m;
        }
        sess.stashKpSnapshot(patch);
      }

      return next;
    });

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
  }, [id]);

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
                {formatRub(montageLineProductRub(row) ?? 0)}
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
                {(() => {
                  const montageRowKey = `montage-${key_id}`;
                  const priceInput = (
                    <input
                      id={`kp-montage-${key_id}-price`}
                      type="text"
                      className="kp-page__services-input"
                      value={row.price}
                      placeholder={KP_DECIMAL_PLACEHOLDER}
                      onChange={updateMontagePriceRow(key_id)}
                      aria-label={`Цена, ${MONTAGE_ROW_LABEL} (карточка ${cardIndex + 1}, из настроек КП)`}
                    />
                  );
                  const quantityInput = (
                    <input
                      id={`kp-montage-${key_id}-quantity`}
                      type="text"
                      readOnly
                      className="kp-page__services-input"
                      value={row.quantity}
                      placeholder={KP_DECIMAL_PLACEHOLDER}
                      aria-label={`Количество, ${MONTAGE_ROW_LABEL} (карточка ${cardIndex + 1}, площадь конструкции)`}
                    />
                  );
                  const unitInput = (
                    <input
                      id={`kp-montage-${key_id}-unit`}
                      type="text"
                      readOnly
                      className="kp-page__services-input"
                      value={row.unit}
                      aria-label={`Единица измерения, ${MONTAGE_ROW_LABEL} (карточка ${cardIndex + 1})`}
                    />
                  );
                  const sumInput = (
                    <input
                      id={`kp-montage-${key_id}-sum`}
                      type="text"
                      readOnly
                      className="kp-page__services-input kp-page__services-input--computed"
                      value={serviceRowSum(row.price, row.quantity)}
                      aria-label={`Сумма, ${MONTAGE_ROW_LABEL} (карточка ${cardIndex + 1}, цена × количество)`}
                    />
                  );
                  const montageDetailFields = [
                    { id: "price", label: "Цена", children: priceInput },
                    {
                      id: "quantity",
                      label: "Количество",
                      children: quantityInput,
                    },
                    { id: "unit", label: "Ед. изм.", children: unitInput },
                    { id: "sum", label: "Сумма", children: sumInput },
                  ];
                  const montageCells = isKpNarrow ? (
                    <>
                      <td className="kp-page__service-name-td--preset">
                        {MONTAGE_ROW_LABEL}
                      </td>
                      <td />
                      <td />
                      <td />
                      <td className="kp-narrow-row-summary-sum">
                        {serviceRowSum(row.price, row.quantity)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="kp-page__service-name-td--preset">
                        {MONTAGE_ROW_LABEL}
                      </td>
                      <td>{priceInput}</td>
                      <td>{quantityInput}</td>
                      <td>{unitInput}</td>
                      <td>{sumInput}</td>
                    </>
                  );
                  if (isKpNarrow) {
                    return (
                      <KpNarrowExpandableRow
                        rowKey={montageRowKey}
                        expandedKey={expandedKey}
                        onToggleRow={toggleRow}
                        narrow
                        colSpan={5}
                        detailTitle={MONTAGE_ROW_LABEL}
                        detailFields={montageDetailFields}
                      >
                        {montageCells}
                      </KpNarrowExpandableRow>
                    );
                  }
                  return <tr>{montageCells}</tr>;
                })()}
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
      isKpNarrow,
      expandedKey,
      toggleRow,
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
          {!isEditingDraft && (
            <button
              type="button"
              onClick={() => navigate("/kp/list")}
              className="add_design_button"
            >
              К списку КП
            </button>
          )}
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
              value={
                isPriceRegionsLoading || visibleRegionOptions.length === 0
                  ? ""
                  : form.region
              }
              onChange={onRegionChange}
              aria-label="Регион прайса"
              disabled={isPriceRegionsLoading || visibleRegionOptions.length === 0}
            >
              {isPriceRegionsLoading ? (
                <option value="">Загрузка регионов...</option>
              ) : visibleRegionOptions.length === 0 ? (
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
            <textarea
              id="kp-object"
              className="kp-page__input"
              rows={1}
              value={form.object}
              onChange={onContactFieldChange("object")}
              onInput={autoResizeNameField}
            />
          </div>
          <div className="kp-page__field-row">
            <label className="kp-page__label" htmlFor="kp-manager">
              Менеджер:
            </label>
            <textarea
              id="kp-manager"
              className="kp-page__input"
              rows={1}
              autoComplete="name"
              value={form.manager}
              onChange={onContactFieldChange("manager")}
              onInput={autoResizeNameField}
            />
          </div>
          <div className="kp-page__field-row">
            <label className="kp-page__label" htmlFor="kp-phone">
              Телефон:
            </label>
            <textarea
              id="kp-phone"
              className="kp-page__input"
              rows={1}
              autoComplete="tel"
              inputMode="tel"
              placeholder="+7 (___) ___-__-__"
              value={form.phone}
              onChange={onContactFieldChange("phone")}
              onInput={autoResizeNameField}
            />
          </div>
          <div className="kp-page__field-row">
            <label className="kp-page__label" htmlFor="kp-email">
              Email:
            </label>
            <textarea
              id="kp-email"
              className="kp-page__input kp-page__input--email"
              rows={1}
              autoComplete="email"
              inputMode="email"
              placeholder="name@example.com"
              value={form.email}
              onChange={onContactFieldChange("email")}
              onInput={autoResizeNameField}
            />
          </div>
          <div className="kp-page__field-row kp-page__field-row--last">
            <label className="kp-page__label" htmlFor="kp-address">
              Адрес офиса:
            </label>
            <textarea
              id="kp-address"
              className="kp-page__input"
              rows={1}
              autoComplete="street-address"
              value={form.officeAddress}
              onChange={onContactFieldChange("officeAddress")}
              onInput={autoResizeNameField}
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
                    settingsSectionOpen
                      ? " kp-collapsible-chevron--expanded"
                      : ""
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
                onGeneralMaterialKpPriceChange={onGeneralMaterialKpPriceChange}
              />
            </>
          ) : (
            <p className="kp-page__tables-empty">
              В этом КП пока нет конструкций. Перейдите в{" "}
              <button
                type="button"
                className="kp-page__link-btn"
                onClick={openCalculatorForConstructions}
              >
                калькулятор
              </button>
              , чтобы добавить.
            </p>
          )}
        </div>

        <div className="kp-page__services">
          <KpCollapsibleExtraTable
            tableId="kp-table-additional-materials"
            ariaLabel="Дополнительные материалы"
            title="Дополнительные материалы"
            sectionOpen={additionalMaterialsSectionOpen}
            onToggleSection={() => setAdditionalMaterialsSectionOpen((v) => !v)}
            totalRub={additionalMaterialsTotalRub}
            colgroup={
              <colgroup>
                <col style={{ width: "50%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "20%" }} />
              </colgroup>
            }
            footerRows={
              <>
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
              </>
            }
          >
            {materialRows.map((row) => {
              const rowKey = `mat-${row.id}`;
              const removeRowButton = (
                <button
                  type="button"
                  className="kp-page__service-row-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeMaterialRow(row.id);
                  }}
                  aria-label="Удалить строку"
                >
                  ×
                </button>
              );
              const nameTextarea = (
                <textarea
                  className="kp-page__services-input kp-page__services-textarea"
                  value={row.name}
                  onChange={(e) => {
                    updateMaterialRow(row.id, "name")(e);
                    syncTextareaHeight(e.target);
                  }}
                  onInput={autoResizeNameField}
                  aria-label="Название материала"
                  rows={1}
                />
              );
              const nameCell = isKpNarrow ? (
                <div className="kp-page__service-name-cell">{nameTextarea}</div>
              ) : (
                <div className="kp-page__service-name-cell">
                  {removeRowButton}
                  {nameTextarea}
                </div>
              );
              const priceInput = (
                <input
                  type="text"
                  className="kp-page__services-input"
                  value={row.price}
                  placeholder={KP_DECIMAL_PLACEHOLDER}
                  onChange={updateMaterialRow(row.id, "price")}
                  aria-label={`Цена, ${row.name || "материал"}`}
                />
              );
              const quantityInput = (
                <input
                  type="text"
                  className="kp-page__services-input"
                  value={row.quantity}
                  placeholder={KP_DECIMAL_PLACEHOLDER}
                  onChange={updateMaterialRow(row.id, "quantity")}
                  aria-label={`Количество, ${row.name || "материал"}`}
                />
              );
              const unitInput = (
                <input
                  type="text"
                  className="kp-page__services-input"
                  value={row.unit}
                  onChange={updateMaterialRow(row.id, "unit")}
                  aria-label={`Единица измерения, ${row.name || "материал"}`}
                />
              );
              const sumInput = (
                <input
                  type="text"
                  readOnly
                  className="kp-page__services-input kp-page__services-input--computed"
                  value={serviceRowSum(row.price, row.quantity)}
                  aria-label={`Сумма, ${row.name || "материал"} (цена × количество)`}
                />
              );
              const detailFields = [
                { id: "name", label: "Название", children: nameCell },
                { id: "price", label: "Цена", children: priceInput },
                { id: "quantity", label: "Количество", children: quantityInput },
                { id: "unit", label: "Ед. изм.", children: unitInput },
                { id: "sum", label: "Сумма", children: sumInput },
              ];
              const rowCells = isKpNarrow ? (
                <>
                  <td>
                    <div className="kp-page__service-name-cell kp-narrow-row-summary-cell">
                      {removeRowButton}
                      <span className="kp-narrow-row-summary-name">
                        {row.name?.trim() ? row.name : "—"}
                      </span>
                    </div>
                  </td>
                  <td />
                  <td />
                  <td />
                  <td className="kp-narrow-row-summary-sum">
                    {serviceRowSum(row.price, row.quantity)}
                  </td>
                </>
              ) : (
                <>
                  <td>{nameCell}</td>
                  <td>{priceInput}</td>
                  <td>{quantityInput}</td>
                  <td>{unitInput}</td>
                  <td>{sumInput}</td>
                </>
              );
              if (isKpNarrow) {
                return (
                  <KpNarrowExpandableRow
                    key={row.id}
                    rowKey={rowKey}
                    expandedKey={expandedKey}
                    onToggleRow={toggleRow}
                    narrow
                    colSpan={5}
                    detailFields={detailFields}
                  >
                    {rowCells}
                  </KpNarrowExpandableRow>
                );
              }
              return <tr key={row.id}>{rowCells}</tr>;
            })}
          </KpCollapsibleExtraTable>

          <KpCollapsibleExtraTable
            tableId="kp-table-services"
            ariaLabel="Дополнительные услуги"
            title="Дополнительные услуги"
            sectionOpen={servicesSectionOpen}
            onToggleSection={() => setServicesSectionOpen((v) => !v)}
            totalRub={servicesTotalRub}
            colgroup={
              <colgroup>
                <col style={{ width: "60%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
              </colgroup>
            }
            footerRows={
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
            }
          >
            {serviceRows.map((row) => {
              const rowKey = `svc-${row.id}`;
              const removeRowButton = row.preset ? null : (
                <button
                  type="button"
                  className="kp-page__service-row-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeServiceRow(row.id);
                  }}
                  aria-label="Удалить строку"
                >
                  ×
                </button>
              );
              const nameTextarea = row.preset ? null : (
                <textarea
                  className="kp-page__services-input kp-page__services-textarea"
                  value={row.name}
                  onChange={(e) => {
                    updateServiceRow(row.id, "name")(e);
                    syncTextareaHeight(e.target);
                  }}
                  onInput={autoResizeNameField}
                  aria-label="Название услуги"
                  rows={1}
                />
              );
              const nameCell = row.preset ? (
                row.name
              ) : isKpNarrow ? (
                <div className="kp-page__service-name-cell">{nameTextarea}</div>
              ) : (
                <div className="kp-page__service-name-cell">
                  {removeRowButton}
                  {nameTextarea}
                </div>
              );
              const priceInput = (
                <input
                  id={row.preset ? `kp-service-${row.id}-price` : undefined}
                  type="text"
                  className="kp-page__services-input"
                  value={row.price}
                  placeholder={KP_DECIMAL_PLACEHOLDER}
                  onChange={updateServiceRow(row.id, "price")}
                  aria-label={`Цена, ${row.name || "услуга"}`}
                />
              );
              const quantityInput = (
                <input
                  id={
                    row.preset ? `kp-service-${row.id}-quantity` : undefined
                  }
                  type="text"
                  className="kp-page__services-input"
                  value={row.quantity}
                  placeholder={KP_DECIMAL_PLACEHOLDER}
                  onChange={updateServiceRow(row.id, "quantity")}
                  aria-label={`Количество, ${row.name || "услуга"}`}
                />
              );
              const unitInput = (
                <input
                  id={row.preset ? `kp-service-${row.id}-unit` : undefined}
                  type="text"
                  className="kp-page__services-input"
                  value={row.unit}
                  onChange={updateServiceRow(row.id, "unit")}
                  aria-label={`Единица измерения, ${row.name || "услуга"}`}
                />
              );
              const sumInput = (
                <input
                  id={`kp-service-${row.id}-sum`}
                  type="text"
                  readOnly
                  className="kp-page__services-input kp-page__services-input--computed"
                  value={serviceRowSum(row.price, row.quantity)}
                  aria-label={`Сумма, ${row.name || "услуга"} (цена × количество)`}
                />
              );
              const detailFields = [
                { id: "name", label: "Название", children: nameCell },
                { id: "price", label: "Цена", children: priceInput },
                { id: "quantity", label: "Количество", children: quantityInput },
                { id: "unit", label: "Ед. изм.", children: unitInput },
                { id: "sum", label: "Сумма", children: sumInput },
              ];
              const nameTdClass = row.preset
                ? "kp-page__service-name-td--preset"
                : undefined;
              const rowCells = isKpNarrow ? (
                <>
                  <td className={nameTdClass}>
                    {row.preset ? (
                      <span className="kp-narrow-row-summary-name">
                        {row.name?.trim() ? row.name : "—"}
                      </span>
                    ) : (
                      <div className="kp-page__service-name-cell kp-narrow-row-summary-cell">
                        {removeRowButton}
                        <span className="kp-narrow-row-summary-name">
                          {row.name?.trim() ? row.name : "—"}
                        </span>
                      </div>
                    )}
                  </td>
                  <td />
                  <td />
                  <td />
                  <td className="kp-narrow-row-summary-sum">
                    {serviceRowSum(row.price, row.quantity)}
                  </td>
                </>
              ) : (
                <>
                  <td className={nameTdClass}>{nameCell}</td>
                  <td>{priceInput}</td>
                  <td>{quantityInput}</td>
                  <td>{unitInput}</td>
                  <td>{sumInput}</td>
                </>
              );
              if (isKpNarrow) {
                return (
                  <KpNarrowExpandableRow
                    key={row.id}
                    rowKey={rowKey}
                    expandedKey={expandedKey}
                    onToggleRow={toggleRow}
                    narrow
                    colSpan={5}
                    detailTitle={row.name?.trim() ? row.name : undefined}
                    detailFields={detailFields}
                  >
                    {rowCells}
                  </KpNarrowExpandableRow>
                );
              }
              return <tr key={row.id}>{rowCells}</tr>;
            })}
          </KpCollapsibleExtraTable>
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
                materialRows,
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
