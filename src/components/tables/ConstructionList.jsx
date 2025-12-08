import React from "react";

/**
 * Таблица со списком конструкций
 */
const ConstructionList = ({ constructions, onDelete }) => {
  if (!constructions || constructions.length === 0) {
    return null;
  }

  return (
    <div className="tbl-in">
      <table className="data" id="table1">
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
              cписок конструкций
            </th>
          </tr>
          <tr>
            <th>шифр</th>
            <th>название</th>
            <th>масса</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {constructions.map((constRItem) => (
            <tr key={constRItem.key_id}>
              <td style={{ textAlign: "right" }}>{constRItem.ag_id}</td>
              <td style={{ textAlign: "center" }}>
                {constRItem.title} , {constRItem.lenX} x {constRItem.lenY}{" "}
                {constRItem.lenZ} мм
              </td>
              <td>{constRItem.weight}</td>
              <td>
                <input
                  type="button"
                  className="counter__button_minus"
                  onClick={() => onDelete(constRItem.key_id)}
                />
                <img
                  src={`${import.meta.env.BASE_URL}delete-icon.jpg`}
                  alt=""
                  style={{
                    height: "30px",
                    opacity: 0.7,
                  }}
                  onClick={() => onDelete(constRItem.key_id)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ConstructionList;





