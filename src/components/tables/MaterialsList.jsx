import { useEffect, useState } from "react";
import {
  convertUnits,
  filterVariable,
  isM2Units,
} from "../../utils/formatters";
import {
  getPricePerM2,
  getPricePerUnit,
} from "../../data/moscowPricePerM2ByArticle";
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
 */
const MaterialsList = ({
  calculatedMaterials,
  data: dataProp,
  tableId = "table2",
  sectionTitle = "Материалы",
  collapsible = false,
  editablePriceCells = false,
  onKpMaterialPriceChange,
}) => {
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handleChange = (event) => setIsNarrowScreen(event.matches);

    // Устанавливаем начальное значение и подписываемся на изменения ширины
    handleChange(mediaQuery);
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

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
        {hasData ? formatRub(totalSumRub) : "—"}
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
                  colSpan={isNarrowScreen ? 4 : 8}
                  className="materials-list__section-title-th"
                >
                  {sectionTitle}
                </th>
              </tr>
            )}
            {showBody && (
              <tr>
                {!isNarrowScreen && <th>артикул</th>}
                <th>название</th>
                <th className="materials-list__col--hidden" />
                <th>кол-во</th>
                <th>ед.изм</th>
                {!isNarrowScreen && <th>цена, ₽/м²</th>}
                {!isNarrowScreen && <th>цена, ₽/ед.</th>}
                {!isNarrowScreen && <th>сумма, ₽</th>}
              </tr>
            )}
          </thead>
        )}
        {showBody && (
          <tbody>
            {hasData ? (
              rowModels.map(
                ({ Material, pricePerM2, pricePerUnit, sumRub }, index) => (
                  <tr key={index}>
                    {!isNarrowScreen && (
                      <td>{filterVariable(Material.Code)}</td>
                    )}
                    <td>{Material.Name}</td>
                    <td className="materials-list__col--hidden" />
                    <td>{convertUnits(Material)}</td>
                    <td>{Material.Units}</td>
                    {!isNarrowScreen &&
                      (editablePriceCells ? (
                        <td>
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
                              pricePerM2 != null
                                ? formatRub(pricePerM2)
                                : "—"
                            }
                            aria-label={`Цена за м², ${Material.Name ?? ""}`}
                          />
                        </td>
                      ) : (
                        <td>{formatRub(pricePerM2)}</td>
                      ))}
                    {!isNarrowScreen &&
                      (editablePriceCells ? (
                        <td>
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
                              pricePerUnit != null
                                ? formatRub(pricePerUnit)
                                : "—"
                            }
                            aria-label={`Цена за единицу, ${Material.Name ?? ""}`}
                          />
                        </td>
                      ) : (
                        <td>{formatRub(pricePerUnit)}</td>
                      ))}
                    {!isNarrowScreen &&
                      (editablePriceCells ? (
                        <td>
                          <input
                            type="text"
                            readOnly
                            className="kp-page__services-input kp-page__services-input--computed"
                            value={formatRub(sumRub)}
                            aria-label={`Сумма, ${Material.Name ?? ""}`}
                          />
                        </td>
                      ) : (
                        <td>{formatRub(sumRub)}</td>
                      ))}
                  </tr>
                )
              )
            ) : (
              <tr>
                <td
                  colSpan={isNarrowScreen ? 4 : 8}
                  className="materials-list__empty-message"
                >
                  {calculatedMaterials != null || dataProp !== undefined
                    ? "Нет данных для отображения"
                    : "Загрузка..."}
                </td>
              </tr>
            )}
          </tbody>
        )}
        {showBody && hasData && (
          <tfoot>
            <tr>
              <td
                colSpan={isNarrowScreen ? 4 : 8}
                className="materials-list__footer-cell"
              >
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








