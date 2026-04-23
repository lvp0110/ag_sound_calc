import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  CALCULATOR_STATE_STORAGE_KEY,
  migrateAdditionalMaterialsFromSavedState,
  migrateMaterialsFromSavedState,
} from "../constants/calculatorSession";
import {
  getRegionLabel,
  setPriceRegion,
  usePriceData,
} from "../services/priceApi";
import "./Calculator.css";
import "./KpPage.css";

function loadCalculatorTablesState() {
  try {
    const raw = sessionStorage.getItem(CALCULATOR_STATE_STORAGE_KEY);
    if (!raw) {
      return {
        tableConstrToCalc: null,
        ConstrToCalc: [],
        materialsByConstruction: [],
      };
    }
    const s = JSON.parse(raw);
    return {
      tableConstrToCalc: s.tableConstrToCalc ?? null,
      ConstrToCalc: Array.isArray(s.ConstrToCalc) ? s.ConstrToCalc : [],
      materialsByConstruction: migrateMaterialsFromSavedState(s),
    };
  } catch {
    return {
      tableConstrToCalc: null,
      ConstrToCalc: [],
      materialsByConstruction: [],
    };
  }
}

function loadAdditionalMaterialsState() {
  try {
    const raw = sessionStorage.getItem(CALCULATOR_STATE_STORAGE_KEY);
    if (!raw) return [];
    const saved = JSON.parse(raw);
    return migrateAdditionalMaterialsFromSavedState(saved);
  } catch {
    return [];
  }
}

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

const KpPage = () => {
  const navigate = useNavigate();
  const { regions, selectedRegion } = usePriceData();
  const [form, setForm] = useState(initialForm);
  const [calcTables, setCalcTables] = useState(loadCalculatorTablesState);
  /** Монтаж по карточкам: key_id конструкции → { price, quantity, unit } */
  const [montageByKeyId, setMontageByKeyId] = useState(() => ({}));
  /** Раскрыт блок «Монтаж» в карточке (по key_id); по умолчанию свёрнут */
  const [montageSectionOpenByKeyId, setMontageSectionOpenByKeyId] = useState(
    () => ({})
  );
  const [materialRows, setMaterialRows] = useState(() => {
    const savedRows = loadAdditionalMaterialsState();
    return savedRows;
  });
  const [serviceRows, setServiceRows] = useState(INITIAL_SERVICE_ROWS);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CALCULATOR_STATE_STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      sessionStorage.setItem(
        CALCULATOR_STATE_STORAGE_KEY,
        JSON.stringify({
          ...s,
          materialsByConstruction: calcTables.materialsByConstruction,
          additionalMaterials: materialRows,
        })
      );
    } catch {
      /* ignore */
    }
  }, [calcTables.materialsByConstruction, materialRows]);

  const onGeneralMaterialKpPriceChange = useCallback(
    (key_id, indexInFullMaterialsData, field, value) => {
      setCalcTables((prev) => ({
        ...prev,
        materialsByConstruction: prev.materialsByConstruction.map((entry) => {
          if (entry.key_id !== key_id) return entry;
          const nextData = entry.data.map((row, i) =>
            i === indexInFullMaterialsData ? { ...row, [field]: value } : row
          );
          return { ...entry, data: nextData };
        }),
      }));
    },
    []
  );

  const onFieldChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const onRegionChange = (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, region: value }));
    setPriceRegion(value);
  };

  useEffect(() => {
    if (!selectedRegion) return;
    setForm((prev) => (prev.region ? prev : { ...prev, region: selectedRegion }));
  }, [selectedRegion]);

  const updateServiceRow = (id, field) => (e) => {
    const value = e.target.value;
    setServiceRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [field]: value } : r))
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
      rows.map((r) => (r.id === id ? { ...r, [field]: value } : r))
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

  const openPriceForMaterialSelection = () => {
    navigate("/price");
  };

  const updateMontageRow = useCallback((key_id, field) => (e) => {
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
  }, []);

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
                      onChange={updateMontageRow(key_id, "price")}
                      aria-label={`Цена, ${MONTAGE_ROW_LABEL} (карточка ${cardIndex + 1})`}
                    />
                  </td>
                  <td>
                    <input
                      id={`kp-montage-${key_id}-quantity`}
                      type="text"
                      className="kp-page__services-input"
                      value={row.quantity}
                      onChange={updateMontageRow(key_id, "quantity")}
                      aria-label={`Количество, ${MONTAGE_ROW_LABEL} (карточка ${cardIndex + 1})`}
                    />
                  </td>
                  <td>
                    <input
                      id={`kp-montage-${key_id}-unit`}
                      type="text"
                      className="kp-page__services-input"
                      value={row.unit}
                      onChange={updateMontageRow(key_id, "unit")}
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
      updateMontageRow,
    ]
  );

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
              value={form.region || selectedRegion}
              onChange={onRegionChange}
              aria-label="Регион прайса"
              disabled={regions.length === 0}
            >
              {regions.length === 0 ? (
                <option value="">Регионы не найдены</option>
              ) : (
                regions.map((region) => (
                  <option key={region} value={region}>
                    {getRegionLabel(region)}
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
              В калькуляторе ещё нет расчёта: добавьте конструкции и нажмите
              «расчёт конструкции», затем снова откройте эту страницу.
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
                            row.preset ? `kp-service-${row.id}-price` : undefined
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
                calcTables.materialsByConstruction
              )}
              montageGrandTotalRub={montageGrandTotalRubForKp(
                calcTables.ConstrToCalc,
                montageByKeyId
              )}
              additionalServicesGrandTotalRub={additionalServicesGrandTotalRubForKp(
                serviceRows
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
      </main>
    </div>
  );
};

export default KpPage;
