import React from "react";
import { convertUnits, filterVariable } from "../../utils/formatters";

/**
 * Таблица со списком материалов
 */
const MaterialsList = ({ calculatedMaterials }) => {
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
              colSpan="5"
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
            <th>артикул</th>
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
                <td>{filterVariable(Material.Code)}</td>
                <td>{Material.Name}</td>
                <td style={{ display: "none" }}></td>
                <td>{convertUnits(Material)}</td>
                <td>{Material.Units}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan="5"
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







