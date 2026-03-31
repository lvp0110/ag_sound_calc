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

const formatRub = (value) => {
  if (value == null || Number.isNaN(value)) return "—";
  return Number(value).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const lineSumRub = (material, pricePerM2, pricePerUnit) => {
  const units = material.Units;
  if (isM2Units(units)) {
    const qtyM2 = Number(material.Quantity) / 1e6;
    if (Number.isNaN(qtyM2)) return null;
    if (pricePerM2 != null) return qtyM2 * pricePerM2;
    if (pricePerUnit != null) return qtyM2 * pricePerUnit;
    return null;
  }
  if (pricePerUnit != null) {
    const q = Number(material.Quantity);
    if (Number.isNaN(q)) return null;
    return q * pricePerUnit;
  }
  return null;
};

/**
 * Таблица со списком материалов
 */
const MaterialsList = ({ calculatedMaterials }) => {
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);

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

  const data = calculatedMaterials?.data;
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

  const totalSumRub = rowModels.reduce((acc, { sumRub }) => {
    return typeof sumRub === "number" && !Number.isNaN(sumRub)
      ? acc + sumRub
      : acc;
  }, 0);

  return (
    <div className="tbl-in">
      <table className="data" id="table2">
        <thead>
          <tr>
            <th
              colSpan={isNarrowScreen ? 4 : 8}
              style={{
                fontSize: "14px",
                fontWeight: "bold",
                textAlign: "center",
              }}
            >
              cписок материалов
            </th>
          </tr>
          <tr>
            {!isNarrowScreen && <th>артикул</th>}
            <th>название</th>
            <th style={{ display: "none" }}></th>
            <th>кол-во</th>
            <th>ед.изм</th>
            {!isNarrowScreen && <th>цена, ₽/м²</th>}
            {!isNarrowScreen && <th>цена, ₽/ед.</th>}
            {!isNarrowScreen && <th>сумма, ₽</th>}
          </tr>
        </thead>
        <tbody>
          {hasData ? (
            rowModels.map(({ Material, pricePerM2, pricePerUnit, sumRub }, index) => (
              <tr key={index}>
                {!isNarrowScreen && (
                  <td>{filterVariable(Material.Code)}</td>
                )}
                <td>{Material.Name}</td>
                <td style={{ display: "none" }}></td>
                <td>{convertUnits(Material)}</td>
                <td>{Material.Units}</td>
                {!isNarrowScreen && (
                  <td>{formatRub(pricePerM2)}</td>
                )}
                {!isNarrowScreen && (
                  <td>{formatRub(pricePerUnit)}</td>
                )}
                {!isNarrowScreen && (
                  <td>{formatRub(sumRub)}</td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={isNarrowScreen ? 4 : 8}
                style={{
                  textAlign: "center",
                  padding: "20px",
                }}
              >
                {calculatedMaterials
                  ? "Нет данных для отображения"
                  : "Загрузка..."}
              </td>
            </tr>
          )}
        </tbody>
        {hasData && (
          <tfoot>
            <tr>
              <td
                colSpan={isNarrowScreen ? 4 : 8}
                style={{
                  fontWeight: "bold",
                  borderTop: "2px solid var(--table-border, #ccc)",
                  paddingLeft: "10px",
                  paddingRight: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "nowrap",
                  }}
                >
                  <span>Итого</span>
                  <span style={{ whiteSpace: "nowrap", textAlign: "right" }}>
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








