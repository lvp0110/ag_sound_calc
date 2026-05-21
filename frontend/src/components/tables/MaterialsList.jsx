import { useState } from "react";
import {
  convertUnits,
  filterVariable,
  isM2Units,
} from "../../utils/formatters";
import {
  getPriceName,
  getPricePerM2,
  getPricePerUnit,
  usePriceData,
} from "../../services/priceApi";
import { KpNarrowExpandableRow } from "../kp/KpNarrowExpandableRow";
import { useCalcConstructionCardsViewport } from "../../hooks/useCalcConstructionCardsViewport";
import { useKpExpandedRow } from "../../hooks/useKpExpandedRow";
import { useKpNarrowViewport } from "../../hooks/useKpNarrowViewport";
import "./MaterialsList.css";

export const formatRub = (value) => {
  if (value == null || Number.isNaN(value)) return "—";
  return Number(value).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/** Те же правила, что ввод цены/количества на КП (пробелы, запятая). */
export function parseKpDecimal(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Сумма строки «Монтаж» (цена × количество) или null, если данные неполные. */
export function montageLineProductRub(row) {
  if (!row || typeof row !== "object") return null;
  const p = parseKpDecimal(row.price);
  const q = parseKpDecimal(row.quantity);
  if (p === null || q === null) return null;
  return p * q;
}

/** Цены строки: вручную на КП (Kp*) или из прайса по артикулу. */
export function effectiveMaterialPrices(material, pricePerM2, pricePerUnit) {
  const kpM2 = parseKpDecimal(material.KpPricePerM2);
  const kpUnit = parseKpDecimal(material.KpPricePerUnit);
  return {
    effM2: kpM2 !== null ? kpM2 : pricePerM2,
    effUnit: kpUnit !== null ? kpUnit : pricePerUnit,
  };
}

const lineSumRub = (material, pricePerM2, pricePerUnit) => {
  const { effM2, effUnit } = effectiveMaterialPrices(
    material,
    pricePerM2,
    pricePerUnit
  );
  const units = material.Units;
  if (isM2Units(units)) {
    const qtyM2 = Number(material.Quantity) / 1e6;
    if (Number.isNaN(qtyM2)) return null;
    if (effM2 != null) return qtyM2 * effM2;
    if (effUnit != null) return qtyM2 * effUnit;
    return null;
  }
  if (effUnit != null) {
    const q = Number(material.Quantity);
    if (Number.isNaN(q)) return null;
    return q * effUnit;
  }
  return null;
};

/** Сумма в ₽ по списку материалов (те же правила, что колонка «сумма»). */
export function computeTotalRubForMaterialsData(data) {
  if (!Array.isArray(data) || data.length === 0) return 0;
  return data.reduce((acc, Material) => {
    const codeRaw = Material.Code != null ? String(Material.Code).trim() : "";
    const pricePerM2 = getPricePerM2(codeRaw);
    const pricePerUnit = getPricePerUnit(codeRaw);
    const sumRub = lineSumRub(Material, pricePerM2, pricePerUnit);
    return typeof sumRub === "number" && !Number.isNaN(sumRub)
      ? acc + sumRub
      : acc;
  }, 0);
}

/** Сумма в ₽ по всем конструкциям (материалы по key_id). */
export function computeGrandTotalRubForConstructions(
  constructions,
  materialsByConstruction
) {
  if (!Array.isArray(constructions) || constructions.length === 0) return 0;
  if (!Array.isArray(materialsByConstruction)) return 0;
  return constructions.reduce((sum, constRItem) => {
    const matEntry = materialsByConstruction.find(
      (m) => m.key_id === constRItem.key_id
    );
    return sum + computeTotalRubForMaterialsData(matEntry?.data ?? []);
  }, 0);
}

/**
 * Таблица со списком материалов
 * @param {object} [calculatedMaterials] — { data: Material[] } (одна группа, например из КП)
 * @param {Material[]} [data] — строки материалов; если задано, имеет приоритет над calculatedMaterials
 * @param {string} [tableId] — id таблицы (для экспорта; по умолчанию table2 для первой группы)
 * @param {string} [sectionTitle] — заголовок блока (по умолчанию «материалы»)
 * @param {boolean} [collapsible=false] — на КП: таблица свёрнута, раскрытие по клику на заголовок
 * @param {boolean} [editablePriceCells=false] — ячейки «цена ₽/м²» и «цена ₽/ед.» как поля ввода (блок общестроительных материалов)
 * @param {(rowIndex: number, field: 'KpPricePerM2'|'KpPricePerUnit', value: string) => void} [onKpMaterialPriceChange]
 * @param {boolean} [compositionOnly=false] — только артикул, название, ед.изм и кол-во (без цен и сумм)
 */
const MaterialsList = ({
  calculatedMaterials,
  data: dataProp,
  tableId = "table2",
  sectionTitle = "Материалы конструкции",
  collapsible = false,
  editablePriceCells = false,
  onKpMaterialPriceChange,
  compositionOnly = false,
}) => {
  const [sectionOpen, setSectionOpen] = useState(false);
  const isNarrowScreen = useKpNarrowViewport();
  const calcCardsViewport = useCalcConstructionCardsViewport();
  const { expandedKey, toggleRow } = useKpExpandedRow();
  usePriceData();

  const data = dataProp ?? calculatedMaterials?.data;
  const hasData = Array.isArray(data) && data.length > 0;

  /** Одна модель строки: те же sumRub, что в колонке «сумма» — итог = их сумма. */
  const rowModels = hasData
    ? data.map((Material) => {
        const codeRaw =
          Material.Code != null ? String(Material.Code).trim() : "";
        const pricePerM2 = getPricePerM2(codeRaw);
        const pricePerUnit = getPricePerUnit(codeRaw);
        const sumRub = lineSumRub(Material, pricePerM2, pricePerUnit);
        return { Material, pricePerM2, pricePerUnit, sumRub };
      })
    : [];

  const totalSumRub = computeTotalRubForMaterialsData(data);

  const showBody = !collapsible || sectionOpen;
  /** Состав конструкции в калькуляторе: < 430px без колонки «артикул». */
  const compositionNarrow = compositionOnly && calcCardsViewport;
  /** Калькулятор: на узком экране убираем колонки из DOM. КП (collapsible): все колонки в DOM, скрытие через CSS. */
  const legacyNarrow = !collapsible && !compositionOnly && isNarrowScreen;
  const colSpan = compositionOnly
    ? compositionNarrow
      ? 3
      : 4
    : legacyNarrow
      ? 4
      : 8;
  const colInDom = compositionOnly || collapsible || !legacyNarrow;
  const showArticleCol = compositionOnly ? !compositionNarrow : colInDom;
  const hideOnKpNarrow = collapsible ? " kp-data-col--hide-narrow" : "";
  const kpNarrowDetail = collapsible && isNarrowScreen && !compositionOnly;

  const collapsibleTitle = collapsible ? (
    <span className="kp-collapsible-title-row">
      <span className="kp-collapsible-title-inner">
        <span
          className={`kp-collapsible-chevron${
            sectionOpen ? " kp-collapsible-chevron--expanded" : ""
          }`}
          aria-hidden
        />
        <span>{sectionTitle}</span>
      </span>
      <span className="kp-collapsible-title-sum" aria-hidden>
        {formatRub(hasData ? totalSumRub : 0)}
      </span>
    </span>
  ) : null;

  return (
    <div className="tbl-in materials-data-table">
      {collapsible && (
        <button
          type="button"
          className="kp-section-collapsible-toggle"
          aria-expanded={sectionOpen}
          onClick={() => setSectionOpen((v) => !v)}
        >
          {collapsibleTitle}
        </button>
      )}
      <table
        className={`data${collapsible ? " kp-data-table--starts-with-column-headers" : ""}`}
        id={tableId}
        data-materials-table="true"
        {...(collapsible
          ? {
              "data-export-section-title": sectionTitle,
              "data-erp-data-start-row": "1",
            }
          : {})}
      >
        {(!collapsible || showBody) && (
          <thead>
            {!collapsible && (
              <tr>
                <th
                  colSpan={colSpan}
                  className="materials-list__section-title-th"
                >
                  {sectionTitle}
                </th>
              </tr>
            )}
            {showBody && (
              <tr>
                {showArticleCol && (
                  <th className={hideOnKpNarrow.trim() || undefined}>артикул</th>
                )}
                <th className={collapsible ? "kp-data-col--name" : undefined}>
                  название
                </th>
                {!compositionOnly && (
                  <th
                    className={`materials-list__col--hidden${hideOnKpNarrow}`}
                  />
                )}
                {colInDom && compositionOnly && (
                  <th className={hideOnKpNarrow.trim() || undefined}>ед.изм</th>
                )}
                {colInDom && (
                  <th className={hideOnKpNarrow.trim() || undefined}>кол-во</th>
                )}
                {colInDom && !compositionOnly && (
                  <th className={hideOnKpNarrow.trim() || undefined}>ед.изм</th>
                )}
                {colInDom && !compositionOnly && (
                  <th className={hideOnKpNarrow.trim() || undefined}>
                    цена, ₽/м²
                  </th>
                )}
                {colInDom && !compositionOnly && (
                  <th className={hideOnKpNarrow.trim() || undefined}>
                    цена, ₽/ед.
                  </th>
                )}
                {colInDom && !compositionOnly && (
                  <th className={collapsible ? "kp-data-col--sum" : undefined}>
                    сумма, ₽
                  </th>
                )}
              </tr>
            )}
          </thead>
        )}
        {showBody && (
          <tbody>
            {hasData ? (
              rowModels.map(({ Material, pricePerM2, pricePerUnit, sumRub }, index) => {
                const codeRaw =
                  Material.Code != null ? String(Material.Code).trim() : "";
                const priceName = compositionOnly ? "" : getPriceName(codeRaw);
                const materialName =
                  priceName !== ""
                    ? priceName
                    : Material.Name != null && String(Material.Name).trim() !== ""
                    ? String(Material.Name).trim()
                    : "—";
                const priceM2Input = editablePriceCells ? (
                  <input
                    type="text"
                    className="kp-page__services-input"
                    value={
                      Material.KpPricePerM2 != null &&
                      Material.KpPricePerM2 !== ""
                        ? String(Material.KpPricePerM2)
                        : ""
                    }
                    onChange={(e) =>
                      onKpMaterialPriceChange?.(
                        index,
                        "KpPricePerM2",
                        e.target.value
                      )
                    }
                    placeholder={
                      pricePerM2 != null ? formatRub(pricePerM2) : formatRub(0)
                    }
                    aria-label={`Цена за м², ${materialName}`}
                  />
                ) : (
                  formatRub(pricePerM2)
                );
                const priceUnitInput = editablePriceCells ? (
                  <input
                    type="text"
                    className="kp-page__services-input"
                    value={
                      Material.KpPricePerUnit != null &&
                      Material.KpPricePerUnit !== ""
                        ? String(Material.KpPricePerUnit)
                        : ""
                    }
                    onChange={(e) =>
                      onKpMaterialPriceChange?.(
                        index,
                        "KpPricePerUnit",
                        e.target.value
                      )
                    }
                    placeholder={
                      pricePerUnit != null ? formatRub(pricePerUnit) : formatRub(0)
                    }
                    aria-label={`Цена за единицу, ${materialName}`}
                  />
                ) : (
                  formatRub(pricePerUnit)
                );
                const sumDisplay = editablePriceCells ? (
                  <input
                    type="text"
                    readOnly
                    className="kp-page__services-input kp-page__services-input--computed"
                    value={formatRub(sumRub)}
                    aria-label={`Сумма, ${materialName}`}
                  />
                ) : (
                  formatRub(sumRub)
                );
                const showInputsInRow = !kpNarrowDetail;
                const detailFields = kpNarrowDetail
                  ? [
                      {
                        id: "article",
                        label: "Артикул",
                        children: filterVariable(Material.Code),
                      },
                      {
                        id: "units",
                        label: "Ед.изм",
                        children: Material.Units ?? "—",
                      },
                      {
                        id: "qty",
                        label: "Кол-во",
                        children: convertUnits(Material),
                      },
                      {
                        id: "priceM2",
                        label: "Цена, ₽/м²",
                        children: priceM2Input,
                      },
                      {
                        id: "priceUnit",
                        label: "Цена, ₽/ед.",
                        children: priceUnitInput,
                      },
                      {
                        id: "sum",
                        label: "Сумма, ₽",
                        children: sumDisplay,
                      },
                    ]
                  : [];
                const rowCells = compositionOnly ? (
                  <>
                    {showArticleCol && (
                      <td className={hideOnKpNarrow.trim() || undefined}>
                        {filterVariable(Material.Code)}
                      </td>
                    )}
                    <td>{materialName}</td>
                    {colInDom && (
                      <td className={hideOnKpNarrow.trim() || undefined}>
                        {Material.Units ?? "—"}
                      </td>
                    )}
                    {colInDom && (
                      <td className={hideOnKpNarrow.trim() || undefined}>
                        {convertUnits(Material)}
                      </td>
                    )}
                  </>
                ) : (
                  <>
                    {colInDom && (
                      <td className={hideOnKpNarrow.trim() || undefined}>
                        {filterVariable(Material.Code)}
                      </td>
                    )}
                    <td
                      className={collapsible ? "kp-data-col--name" : undefined}
                    >
                      {materialName}
                    </td>
                    <td
                      className={`materials-list__col--hidden${hideOnKpNarrow}`}
                    />
                    {colInDom && (
                      <td className={hideOnKpNarrow.trim() || undefined}>
                        {convertUnits(Material)}
                      </td>
                    )}
                    {colInDom && (
                      <td className={hideOnKpNarrow.trim() || undefined}>
                        {Material.Units}
                      </td>
                    )}
                    {colInDom && (
                      <td className={hideOnKpNarrow.trim() || undefined}>
                        {showInputsInRow && editablePriceCells
                          ? priceM2Input
                          : formatRub(pricePerM2)}
                      </td>
                    )}
                    {colInDom && (
                      <td className={hideOnKpNarrow.trim() || undefined}>
                        {showInputsInRow && editablePriceCells
                          ? priceUnitInput
                          : formatRub(pricePerUnit)}
                      </td>
                    )}
                    {colInDom && (
                      <td
                        className={
                          collapsible ? "kp-data-col--sum" : undefined
                        }
                      >
                        {showInputsInRow && editablePriceCells
                          ? sumDisplay
                          : formatRub(sumRub)}
                      </td>
                    )}
                  </>
                );
                if (kpNarrowDetail) {
                  return (
                    <KpNarrowExpandableRow
                      key={index}
                      rowKey={index}
                      expandedKey={expandedKey}
                      onToggleRow={toggleRow}
                      narrow
                      colSpan={8}
                      detailFields={detailFields}
                    >
                      {rowCells}
                    </KpNarrowExpandableRow>
                  );
                }
                return <tr key={index}>{rowCells}</tr>;
              })
            ) : (
              <tr>
                <td colSpan={colSpan} className="materials-list__empty-message">
                  {calculatedMaterials != null || dataProp !== undefined
                    ? "Нет данных для отображения"
                    : "Загрузка..."}
                </td>
              </tr>
            )}
          </tbody>
        )}
        {showBody && hasData && !compositionOnly && (
          <tfoot>
            <tr>
              <td colSpan={colSpan} className="materials-list__footer-cell">
                <div className="materials-list__footer-inner">
                  <span>Стоимость</span>
                  <span className="materials-list__footer-sum">
                    {formatRub(totalSumRub)}
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

export default MaterialsList;








