import React from "react";

/**
 * Форма ввода размеров для полов
 */
const FloorForm = ({ constR, onLenXChange, onLenYChange }) => {
  return (
    <div className="inputsFloorAll">
      <h4 style={{ margin: "5px" }}>размер конструкции</h4>
      <input
        type="number"
        placeholder="ширина,мм"
        value={constR.lenX || ""}
        onChange={(e) => onLenXChange(e.target.value)}
      />
      <input
        type="number"
        placeholder="длина,мм"
        value={constR.lenY || ""}
        onChange={(e) => onLenYChange(e.target.value)}
      />
    </div>
  );
};

export default FloorForm;





