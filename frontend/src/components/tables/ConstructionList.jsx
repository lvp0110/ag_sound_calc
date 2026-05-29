import { Fragment, useCallback, useMemo, useState } from "react";
import { useCalcConstructionCardsViewport } from "../../hooks/useCalcConstructionCardsViewport";
import { filterVariable } from "../../utils/formatters";
import MaterialsList, {
  computeGrandTotalRubForConstructions,
  computeTotalRubForMaterialsData,
  formatRub,
  montageLineProductRub,
} from "./MaterialsList";
import { sectionLabelForConstruction } from "../../utils/constructionSection";
import "./ConstructionList.css";

/** Строка итога «Стоимость конструкций» (экспорт для КП: итог после блока «Услуги»). */
export function ConstructionGrandTotalBlock({
  readOnly,
  grandTotalRub,
  /** Итог монтажа по КП (передаётся только на странице КП). */
  montageGrandTotalRub,
  /** Итог блока доп. материалов по КП. */
  additionalMaterialsGrandTotalRub,
  /** Итог доп. услуг по КП (блок «Услуги»). */
  additionalServicesGrandTotalRub,
  wrapClassName = "",
}) {
  const titleColSpan = readOnly ? 3 : 4;
  const grandTotalCardClass = readOnly ? " kp-table-card" : "";
  const showMontageRow = montageGrandTotalRub !== undefined;
  const showAdditionalMaterialsRow = additionalMaterialsGrandTotalRub !== undefined;
  const showServicesRow = additionalServicesGrandTotalRub !== undefined;
  const montagePart =
    typeof montageGrandTotalRub === "number" && !Number.isNaN(montageGrandTotalRub)
      ? montageGrandTotalRub
      : 0;
  const servicesPart =
    typeof additionalServicesGrandTotalRub === "number" &&
    !Number.isNaN(additionalServicesGrandTotalRub)
      ? additionalServicesGrandTotalRub
      : 0;
  const additionalMaterialsPart =
    typeof additionalMaterialsGrandTotalRub === "number" &&
    !Number.isNaN(additionalMaterialsGrandTotalRub)
      ? additionalMaterialsGrandTotalRub
      : 0;
  const overallTotalRub =
    (typeof grandTotalRub === "number" && !Number.isNaN(grandTotalRub)
      ? grandTotalRub
      : 0) +
    (showMontageRow ? montagePart : 0) +
    (showAdditionalMaterialsRow ? additionalMaterialsPart : 0) +
    (showServicesRow ? servicesPart : 0);

  const lineLabelClass = readOnly
    ? "construction-grand-total__line-label"
    : "construction-grand-total__line-label construction-grand-total__line-label--calc";
  const lineAmountClass = readOnly
    ? "construction-grand-total__line-amount"
    : "construction-grand-total__line-amount construction-grand-total__line-amount--calc";
  return (
    <div
      className={`tbl-in construction-grand-total-wrap${grandTotalCardClass}${
        wrapClassName ? ` ${wrapClassName}` : ""
      }`}
    >
      <table
        className="data"
        id="table-grand-total"
        data-export-all-rows="true"
      >
        <tbody>
          <tr className="construction-grand-total__line construction-grand-total__line--first">
            <th
              colSpan={Math.max(1, titleColSpan - 1)}
              className={lineLabelClass}
            >
              Стоимость конструкций
            </th>
            <th className={lineAmountClass}>{formatRub(grandTotalRub)}</th>
          </tr>
          {showMontageRow && (
            <tr className="construction-grand-total__line construction-grand-total__line--next">
              <th
                colSpan={Math.max(1, titleColSpan - 1)}
                className={lineLabelClass}
              >
                Стоимость монтажа
              </th>
              <th className={lineAmountClass}>
                {formatRub(montageGrandTotalRub)}
              </th>
            </tr>
          )}
          {showServicesRow && (
            <tr className="construction-grand-total__line construction-grand-total__line--next">
              <th
                colSpan={Math.max(1, titleColSpan - 1)}
                className={lineLabelClass}
              >
                Стоимость дополнительных услуг
              </th>
              <th className={lineAmountClass}>
                {formatRub(additionalServicesGrandTotalRub)}
              </th>
            </tr>
          )}
          {showAdditionalMaterialsRow && (
            <tr className="construction-grand-total__line construction-grand-total__line--next">
              <th
                colSpan={Math.max(1, titleColSpan - 1)}
                className={lineLabelClass}
              >
                Стоимость дополнительных материалов
              </th>
              <th className={lineAmountClass}>
                {formatRub(additionalMaterialsGrandTotalRub)}
              </th>
            </tr>
          )}
          <tr className="construction-grand-total__total-row">
            <th
              colSpan={Math.max(1, titleColSpan - 1)}
              className={
                readOnly
                  ? "construction-grand-total__total-label"
                  : "construction-grand-total__total-label construction-grand-total__total-label--calc"
              }
            >
              Общий итог
            </th>
            <th
              className={
                readOnly
                  ? "construction-grand-total__total-amount"
                  : "construction-grand-total__total-amount construction-grand-total__total-amount--calc"
              }
            >
              {formatRub(overallTotalRub)}
            </th>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Размер в мм для ячейки таблицы */
function formatConstructionMm(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return String(n);
}

/**
 * Вторая величина: для стен/перегородок — высота (lenZ), для пола/потолка — длина (lenY).
 */
function constructionHeightMm({ lenY, lenZ }) {
  const z = lenZ != null && lenZ !== "" ? Number(lenZ) : NaN;
  if (!Number.isNaN(z) && z > 0) return lenZ;
  return lenY;
}

function constructionDimensionsMm(item) {
  const width = formatConstructionMm(item.lenX);
  const height = formatConstructionMm(constructionHeightMm(item));
  return `${width} x ${height}`;
}

function parseConstructionNumber(value) {
  if (value == null || value === "") return NaN;
  const normalized = String(value).replace(",", ".").trim();
  const numericMatch = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!numericMatch) return NaN;
  const parsed = Number(numericMatch[0]);
  return Number.isNaN(parsed) ? NaN : parsed;
}

function constructionAreaM2(item) {
  const widthMm = parseConstructionNumber(item.lenX);
  const heightMm = parseConstructionNumber(constructionHeightMm(item));
  if (Number.isNaN(widthMm) || Number.isNaN(heightMm)) return NaN;
  if (widthMm <= 0 || heightMm <= 0) return NaN;
  return (widthMm * heightMm) / 1000000;
}

function formatConstructionAreaM2(item) {
  const area = constructionAreaM2(item);
  if (Number.isNaN(area)) return "—";
  return area.toFixed(1);
}

function constructionDisplayTitle({ title, type }) {
  const cleanTitle = title != null ? String(title).trim() : "";
  if (cleanTitle === "") return "";
  const sectionType = String(type ?? "").trim().toUpperCase();
  const isCeilingSection = sectionType === "ПОТОЛОК";
  const isCladdingSection = sectionType === "ОБЛИЦОВКА";
  const isZipsConstruction = cleanTitle.toUpperCase().startsWith("ЗИПС");
  if (isCeilingSection && isZipsConstruction) {
    return `Потолок ${cleanTitle}`;
  }
  if (isCladdingSection && isZipsConstruction) {
    return `Облицовка ${cleanTitle}`;
  }
  return cleanTitle;
}

/** Заголовок карточки: секция расчёта + название конструкции. */
function constructionCardHeading(item) {
  const { title, type, ag_id: code } = item;
  const displayTitle = constructionDisplayTitle({ title, type });
  const normalizedCode = code != null ? String(code).trim() : "";
  const looksLikeConstructionCode = /^AG\.[A-Z0-9._-]+$/i.test(
    String(displayTitle || "").trim()
  );
  const safeDisplayTitle =
    displayTitle !== "" &&
    displayTitle !== normalizedCode &&
    !looksLikeConstructionCode
      ? displayTitle
      : "";
  const constructionPart =
    safeDisplayTitle !== "" ? safeDisplayTitle : "Конструкция";
  const sectionLabel = sectionLabelForConstruction(item);
  if (!sectionLabel) return constructionPart;
  const prefix = `${sectionLabel} `;
  if (constructionPart.toLowerCase().startsWith(prefix.toLowerCase())) {
    return constructionPart;
  }
  return `${sectionLabel} ${constructionPart}`;
}

/** Колонка «название» в legacy-таблице: не дублируем шифр, если title = ag_id. */
function constructionLegacyTitle(item) {
  const display = constructionDisplayTitle(item);
  const code = String(item.ag_id ?? "").trim();
  if (code !== "" && display === code) return "";
  return display;
}

function constructionDisplayNameOrCode(item) {
  const title = constructionLegacyTitle(item);
  if (title) return title;
  return String(item.ag_id ?? "").trim() || "—";
}

/** Как в колонке «артикул»: без цифры в начале кода показывается «---». */
function splitMaterialsByArticleDisplay(materials) {
  if (!Array.isArray(materials)) return { withArticle: [], noArticle: [] };
  const withArticle = [];
  const noArticle = [];
  for (const m of materials) {
    if (filterVariable(m.Code) === "---") noArticle.push(m);
    else withArticle.push(m);
  }
  return { withArticle, noArticle };
}

/** Индексы строк без артикула в исходном `data` карточки (для сопоставления с `noArticle`). */
function noArticleIndicesInMaterialsData(materials) {
  if (!Array.isArray(materials)) return [];
  const idx = [];
  for (let i = 0; i < materials.length; i += 1) {
    if (filterVariable(materials[i].Code) === "---") idx.push(i);
  }
  return idx;
}

function LegacyConstructionMaterialsPanels({
  withArticle,
  noArticle,
  baseTableId,
  showGeneralConstructionMaterials,
}) {
  return (
    <>
      {withArticle.length === 0 && noArticle.length === 0 && (
        <MaterialsList data={[]} tableId={baseTableId} compositionOnly />
      )}
      {withArticle.length > 0 && (
        <MaterialsList
          data={withArticle}
          tableId={baseTableId}
          compositionOnly
        />
      )}
      {showGeneralConstructionMaterials && noArticle.length > 0 && (
        <MaterialsList
          data={noArticle}
          tableId={
            withArticle.length > 0 ? `${baseTableId}-misc` : baseTableId
          }
          sectionTitle="Общестроительные материалы"
          compositionOnly
        />
      )}
    </>
  );
}

/**
 * Таблица со списком конструкций
 * @param {boolean} [readOnly] — без колонки удаления (например, страница КП)
 * @param {Array<{ key_id: number, data: unknown[] }>} [materialsByConstruction] — если задано, под каждой конструкцией выводится свой список материалов (без суммирования между конструкциями)
 * @param {boolean} [showGeneralConstructionMaterials=true] — блок «Общестроительные материалы» (без артикула)
 * @param {(ctx: { key_id: number, cardIndex: number }) => import("react").ReactNode} [renderKpMontageSlot] — раздел «Монтаж» в каждой карточке конструкции на КП (не в «Услугах» и не в строке итога)
 * @param {Record<number, { price?: string, quantity?: string, unit?: string }>} [montageByKeyId] — монтаж по карточке (КП); для итога под карточкой
 * @param {(key_id: number, indexInFullMaterialsData: number, field: 'KpPricePerM2'|'KpPricePerUnit', value: string) => void} [onGeneralMaterialKpPriceChange] — правка цен «Общестроительные материалы»
 * @param {boolean} [legacyTableWithMaterials] — таблица-список: по клику на название под строкой показываются материалы (калькулятор)
 */
const ConstructionList = ({
  constructions,
  onDelete = () => {},
  readOnly = false,
  showHeadingDeleteButton = false,
  materialsByConstruction,
  legacyTableWithMaterials = false,
  showGeneralConstructionMaterials = true,
  renderKpMontageSlot,
  renderKpAdditionalMaterialsSlot,
  /** { [key_id]: number } — суммы доп. материалов по конструкциям для итоговой строки карточки. */
  additionalMaterialsRubByKeyId,
  montageByKeyId,
  /** На КП итог выводится отдельным блоком ниже «Услуги». */
  showGrandTotalInline = true,
  onGeneralMaterialKpPriceChange,
}) => {
  const [collapseOverrides, setCollapseOverrides] = useState({});
  const [expandedLegacyKeyId, setExpandedLegacyKeyId] = useState(null);
  const legacyCardsLayout = useCalcConstructionCardsViewport();

  // Если есть renderKpAdditionalMaterialsSlot — карточки развёрнуты по умолчанию.
  const defaultCollapsed = !renderKpAdditionalMaterialsSlot;

  const collapsedCardsByKeyId = useMemo(() => {
    if (!Array.isArray(constructions) || constructions.length === 0) return {};
    const next = {};
    for (const item of constructions) {
      next[item.key_id] = collapseOverrides[item.key_id] ?? defaultCollapsed;
    }
    return next;
  }, [constructions, collapseOverrides, defaultCollapsed]);

  const expandedLegacyKeyIdActive = useMemo(() => {
    if (expandedLegacyKeyId == null) return null;
    return constructions.some((c) => c.key_id === expandedLegacyKeyId)
      ? expandedLegacyKeyId
      : null;
  }, [constructions, expandedLegacyKeyId]);

  const toggleCardCollapsed = useCallback((key_id) => {
    setCollapseOverrides((prev) => ({
      ...prev,
      [key_id]: !(prev[key_id] ?? true),
    }));
  }, []);

  const toggleLegacyMaterials = useCallback((key_id) => {
    setExpandedLegacyKeyId((prev) => (prev === key_id ? null : key_id));
  }, []);

  if (!constructions || constructions.length === 0) {
    return null;
  }

  /** Карточки КП: конструкция и материалы в одном блоке (не legacy-таблица калькулятора). */
  const interleaved =
    materialsByConstruction != null && !legacyTableWithMaterials;

  if (interleaved) {
    return (
      <div className="construction-materials-blocks">
        {constructions.map((constRItem, index) => {
          const cardCollapsed = collapsedCardsByKeyId[constRItem.key_id] ?? true;
          const matEntry = materialsByConstruction.find(
            (m) => m.key_id === constRItem.key_id
          );
          const materialsData = matEntry?.data ?? [];
          const { withArticle, noArticle } =
            splitMaterialsByArticleDisplay(materialsData);
          const miscRowToFullIndex = noArticleIndicesInMaterialsData(
            materialsData
          );
          const materialsRubTotal =
            computeTotalRubForMaterialsData(materialsData);
          const montageRubCard = montageLineProductRub(
            montageByKeyId?.[constRItem.key_id]
          );
          const additionalMaterialsRubCard =
            additionalMaterialsRubByKeyId?.[constRItem.key_id] ?? 0;
          const cardSectionsTotalRub =
            materialsRubTotal + (montageRubCard ?? 0) + additionalMaterialsRubCard;
          const baseTableId = index === 0 ? "table2" : `table2-${index}`;
          const groupBody = (
            <>
              <div className="tbl-in">
                <table className="data" id={index === 0 ? "table1" : undefined}>
                  <thead>
                    <tr>
                      <th
                        colSpan={readOnly ? 3 : 4}
                        className="construction-card__heading-th"
                      >
                        <div className="construction-card__heading-content">
                          <button
                            type="button"
                            className="construction-card__heading-toggle"
                            aria-expanded={!cardCollapsed}
                            onClick={() => toggleCardCollapsed(constRItem.key_id)}
                          >
                            <span
                              className={`construction-card__heading-chevron${
                                cardCollapsed
                                  ? ""
                                  : " construction-card__heading-chevron--expanded"
                              }`}
                              aria-hidden
                            />
                            <span className="construction-card__heading-title">
                              {constructionCardHeading(constRItem)}
                            </span>
                          </button>
                          {showHeadingDeleteButton && (
                            <button
                              type="button"
                              className="construction-card__heading-delete-button"
                              onClick={() => onDelete(constRItem.key_id)}
                              aria-label={`Удалить конструкцию ${constructionCardHeading(constRItem)}`}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </th>
                    </tr>
                    {!cardCollapsed && (
                      <tr>
                        {!readOnly && <th className="construction-card__delete-col" />}
                        <th className="tbl-in__cipher-col">
                          {readOnly ? "название" : "шифр"}
                        </th>
                        <th className="construction-card__dim-th">размеры, мм</th>
                        <th>площадь, м2</th>
                      </tr>
                    )}
                  </thead>
                  {!cardCollapsed && (
                    <tbody>
                      <tr>
                        {!readOnly && (
                          <td className="construction-card__delete-col">
                            <input
                              type="button"
                              className="counter__button_minus"
                              onClick={() => onDelete(constRItem.key_id)}
                            />
                            <img
                              src={`${import.meta.env.BASE_URL}delete-icon.jpg`}
                              alt=""
                              className="construction-card__delete-icon"
                              loading="lazy"
                              decoding="async"
                              onClick={() => onDelete(constRItem.key_id)}
                            />
                          </td>
                        )}
                        <td className="tbl-in__cipher-col">
                          {readOnly
                            ? constructionDisplayNameOrCode(constRItem)
                            : constRItem.ag_id}
                        </td>
                        <td className="construction-card__dim-td">
                          {constructionDimensionsMm(constRItem)}
                        </td>
                        <td>{formatConstructionAreaM2(constRItem)}</td>
                      </tr>
                    </tbody>
                  )}
                </table>
              </div>
              {!cardCollapsed && withArticle.length === 0 && noArticle.length === 0 && (
                <MaterialsList
                  data={[]}
                  tableId={baseTableId}
                  collapsible={readOnly}
                />
              )}
              {!cardCollapsed && withArticle.length > 0 && (
                <MaterialsList
                  data={withArticle}
                  tableId={baseTableId}
                  collapsible={readOnly}
                />
              )}
              {!cardCollapsed && showGeneralConstructionMaterials && noArticle.length > 0 && (
                <MaterialsList
                  data={noArticle}
                  tableId={
                    withArticle.length > 0 ? `${baseTableId}-misc` : baseTableId
                  }
                  sectionTitle="Общестроительные материалы"
                  collapsible={readOnly}
                  editablePriceCells={readOnly && !!onGeneralMaterialKpPriceChange}
                  onKpMaterialPriceChange={(rowIndex, field, value) => {
                    const fullIdx = miscRowToFullIndex[rowIndex];
                    if (fullIdx === undefined) return;
                    onGeneralMaterialKpPriceChange?.(
                      constRItem.key_id,
                      fullIdx,
                      field,
                      value
                    );
                  }}
                />
              )}
            </>
          );

          return (
            <div
              key={constRItem.key_id}
              className="construction-materials-block"
            >
              {readOnly ? (
                <div className="kp-table-card kp-table-card--group">
                  {groupBody}
                  {!cardCollapsed && typeof renderKpMontageSlot === "function"
                    ? renderKpMontageSlot({
                        key_id: constRItem.key_id,
                        cardIndex: index,
                      })
                    : null}
                  {!cardCollapsed && typeof renderKpAdditionalMaterialsSlot === "function"
                    ? renderKpAdditionalMaterialsSlot({
                        key_id: constRItem.key_id,
                        cardIndex: index,
                      })
                    : null}
                  <div className="tbl-in kp-card-sections-total-wrap">
                    <table
                      className="data kp-card-sections-total-table"
                      id={`kp-card-sections-total-${constRItem.key_id}`}
                      aria-label={`Итого, карточка ${index + 1}`}
                    >
                      <tbody>
                        <tr>
                          <td className="kp-card-sections-total__cell">
                            <div className="kp-card-sections-total__inner">
                              <span className="kp-card-sections-total__label">
                                Итого
                              </span>
                              <span className="kp-card-sections-total__amount">
                                {formatRub(cardSectionsTotalRub)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                groupBody
              )}
            </div>
          );
        })}
        {showGrandTotalInline && (
          <ConstructionGrandTotalBlock
            readOnly={readOnly}
            grandTotalRub={computeGrandTotalRubForConstructions(
              constructions,
              materialsByConstruction
            )}
          />
        )}
      </div>
    );
  }

  const legacyColSpan = readOnly ? 3 : 4;
  const useLegacyCards =
    legacyTableWithMaterials && legacyCardsLayout;

  if (useLegacyCards) {
    return (
      <div className="tbl-in construction-list-legacy-cards-wrap">
        <div
          className="construction-list-legacy-cards"
          role="list"
          aria-label="Список конструкций"
        >
          {constructions.map((constRItem, index) => {
            const legacyExpanded = expandedLegacyKeyIdActive === constRItem.key_id;
            const matEntry = materialsByConstruction?.find(
              (m) => m.key_id === constRItem.key_id,
            );
            const materialsData = matEntry?.data ?? [];
            const { withArticle, noArticle } =
              splitMaterialsByArticleDisplay(materialsData);
            const baseTableId = index === 0 ? "table2" : `table2-${index}`;
            const legacyTitle =
              constructionLegacyTitle(constRItem) || constRItem.ag_id || "";
            const materialsPanelId = `construction-legacy-materials-${constRItem.key_id}`;

            return (
              <article
                key={constRItem.key_id}
                role="listitem"
                className={`construction-list-legacy-card${
                  legacyExpanded
                    ? " construction-list-legacy-card--expanded"
                    : ""
                }`}
              >
                <div className="construction-list-legacy-card__header">
                  <button
                    type="button"
                    className="construction-list-legacy-card__toggle"
                    onClick={() => toggleLegacyMaterials(constRItem.key_id)}
                    aria-expanded={legacyExpanded}
                    aria-controls={materialsPanelId}
                    title={
                      legacyExpanded ? "Скрыть материалы" : "Показать материалы"
                    }
                  >
                    <span
                      className={`construction-list-legacy__title-chevron${
                        legacyExpanded
                          ? " construction-list-legacy__title-chevron--expanded"
                          : ""
                      }`}
                      aria-hidden
                    />
                    <span className="construction-list-legacy-card__body">
                      <span className="construction-list-legacy-card__title">
                        {legacyTitle}
                      </span>
                      <span className="construction-list-legacy-card__meta">
                        <span className="construction-list-legacy-card__meta-item">
                          <span className="construction-list-legacy-card__meta-label">
                            шифр
                          </span>
                          <span className="construction-list-legacy-card__meta-value">
                            {constRItem.ag_id ?? "—"}
                          </span>
                        </span>
                        <span className="construction-list-legacy-card__meta-item">
                          <span className="construction-list-legacy-card__meta-label">
                            размеры, мм
                          </span>
                          <span className="construction-list-legacy-card__meta-value">
                            {constructionDimensionsMm(constRItem)}
                          </span>
                        </span>
                      </span>
                    </span>
                  </button>
                  {!readOnly && (
                    <button
                      type="button"
                      className="construction-list-legacy-card__delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(constRItem.key_id);
                      }}
                      aria-label={`Удалить конструкцию ${legacyTitle}`}
                    >
                      <img
                        src={`${import.meta.env.BASE_URL}delete-icon.jpg`}
                        alt=""
                        className="construction-card__delete-icon"
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  )}
                </div>
                {legacyExpanded && (
                  <div
                    id={materialsPanelId}
                    className="construction-list-legacy-card__materials"
                  >
                    <LegacyConstructionMaterialsPanels
                      withArticle={withArticle}
                      noArticle={noArticle}
                      baseTableId={baseTableId}
                      showGeneralConstructionMaterials={
                        showGeneralConstructionMaterials
                      }
                    />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        readOnly
          ? "tbl-in kp-table-card"
          : "tbl-in"
      }
    >
      <table className="data" id="table1">
        <thead>
          <tr>
            {!readOnly && <th className="construction-card__delete-col" />}
            <th className="tbl-in__cipher-col">шифр</th>
            <th>название</th>
            <th className="construction-list-legacy__dim-th">размеры, мм</th>
          </tr>
        </thead>
        <tbody>
          {constructions.map((constRItem, index) => {
            const legacyExpanded =
              legacyTableWithMaterials &&
              expandedLegacyKeyIdActive === constRItem.key_id;
            const matEntry = legacyTableWithMaterials
              ? materialsByConstruction?.find(
                  (m) => m.key_id === constRItem.key_id,
                )
              : null;
            const materialsData = matEntry?.data ?? [];
            const { withArticle, noArticle } =
              splitMaterialsByArticleDisplay(materialsData);
            const baseTableId = index === 0 ? "table2" : `table2-${index}`;
            const legacyTitle =
              constructionLegacyTitle(constRItem) || constRItem.ag_id || "";
            const titleExpandable = legacyTableWithMaterials && legacyTitle !== "";

            return (
              <Fragment key={constRItem.key_id}>
                <tr>
                  {!readOnly && (
                    <td className="construction-card__delete-col">
                      <input
                        type="button"
                        className="counter__button_minus"
                        onClick={() => onDelete(constRItem.key_id)}
                      />
                      <img
                        src={`${import.meta.env.BASE_URL}delete-icon.jpg`}
                        alt=""
                        className="construction-card__delete-icon"
                        loading="lazy"
                        decoding="async"
                        onClick={() => onDelete(constRItem.key_id)}
                      />
                    </td>
                  )}
                  <td className="construction-list-legacy__code-td tbl-in__cipher-col">
                    {constRItem.ag_id}
                  </td>
                  <td className="construction-list-legacy__title-td">
                    {titleExpandable ? (
                      <button
                        type="button"
                        className="construction-list-legacy__title-button"
                        onClick={() => toggleLegacyMaterials(constRItem.key_id)}
                        aria-expanded={legacyExpanded}
                        aria-controls={`construction-legacy-materials-${constRItem.key_id}`}
                        title={legacyExpanded ? "Скрыть материалы" : "Показать материалы"}
                      >
                        <span
                          className={`construction-list-legacy__title-chevron${
                            legacyExpanded
                              ? " construction-list-legacy__title-chevron--expanded"
                              : ""
                          }`}
                          aria-hidden
                        />
                        {legacyTitle}
                      </button>
                    ) : (
                      constructionLegacyTitle(constRItem)
                    )}
                  </td>
                  <td className="construction-list-legacy__dim-td">
                    {constructionDimensionsMm(constRItem)}
                  </td>
                </tr>
                {legacyExpanded && (
                  <tr
                    id={`construction-legacy-materials-${constRItem.key_id}`}
                    className="construction-list-legacy__materials-row"
                  >
                    <td
                      colSpan={legacyColSpan}
                      className="construction-list-legacy__materials-cell"
                    >
                      <LegacyConstructionMaterialsPanels
                        withArticle={withArticle}
                        noArticle={noArticle}
                        baseTableId={baseTableId}
                        showGeneralConstructionMaterials={
                          showGeneralConstructionMaterials
                        }
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ConstructionList;
