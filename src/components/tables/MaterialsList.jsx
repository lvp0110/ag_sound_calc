import React, { useEffect, useState } from "react";
import { convertUnits, filterVariable } from "../../utils/formatters";

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

  const hasData =
    calculatedMaterials &&
    calculatedMaterials.data &&
    calculatedMaterials.data.length > 0;

  return (
    <div className="tbl-in">
      <table className="data" id="table2">
        <thead>
          <tr>
            <th
              colSpan={isNarrowScreen ? 4 : 5}
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
          </tr>
        </thead>
        <tbody>
          {hasData ? (
            calculatedMaterials.data.map((Material, index) => (
              <tr key={index}>
                {!isNarrowScreen && (
                  <td>{filterVariable(Material.Code)}</td>
                )}
                <td>{Material.Name}</td>
                <td style={{ display: "none" }}></td>
                <td>{convertUnits(Material)}</td>
                <td>{Material.Units}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={isNarrowScreen ? 4 : 5}
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
      </table>
    </div>
  );
};

export default MaterialsList;








