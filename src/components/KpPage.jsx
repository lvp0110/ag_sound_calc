import { useCallback, useEffect, useRef, useState } from "react";
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
  mapOfferResponseToKpView,
} from "../utils/offerMapper";
import { getAllIsolationConstr } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";
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
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthed, status: authStatus, openLoginModal } = useAuth();

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
    () => ({})
  );
  const [materialRows, setMaterialRows] = useState(() => [newCustomMaterialRow()]);
  const [serviceRows, setServiceRows] = useState(INITIAL_SERVICE_ROWS);

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
      openLoginModal();
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
          if (row?.Code) titleByCode.set(row.Code, { Name: row.Name, Description: row.Description });
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
          view.serviceRows.length > 0 ? view.serviceRows : INITIAL_SERVICE_ROWS
        );
        // Доп. материалы хранятся независимо (offer.additional_materials).
        // Если пустой список — показываем одну пустую строку для удобства добавления.
        setMaterialRows(
          view.materialRows.length > 0 ? view.materialRows : [newCustomMaterialRow()]
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
  }, [id, isAuthed, authStatus, openLoginModal]);

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
              type="text"
              value={form.date}
              onChange={onFieldChange("date")}
            />
          </div>
          <div className="kp-page__field-row">
            <label className="kp-page__label" htmlFor="kp-region">
              Регион:
            </label>
            <input
              id="kp-region"
              className="kp-page__input"
              type="text"
              autoComplete="address-level1"
              value={form.region}
              onChange={onFieldChange("region")}
            />
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
                aria-label="Дополнительне услуги"
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
                    <th colSpan={5}>Дополнительне услуги</th>
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
              wrapClassName="kp-page__construction-grand-total"
            />
          )}

        <div className="kp-page__save-bar">
          {saveError && (
            <div className="kp-page__save-error" role="alert">{saveError}</div>
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
