import React from "react";

/**
 * Форма ввода размеров для облицовки и перегородок
 */
const FacingForm = ({ constR, onLenXChange, onLenZChange, onShowParams, className }) => {
  return (
    <div className={className}>
      <h4 style={{ margin: "5px" }}>размер конструкции</h4>
      <input
        type="number"
        placeholder="ширина,мм"
        value={constR.lenX || ""}
        onChange={(e) => onLenXChange(e.target.value)}
      />
      <input
        type="number"
        placeholder="высота,мм"
        value={constR.lenZ || ""}
        onChange={(e) => onLenZChange(e.target.value)}
      />
      <button
        className="counter__button_param"
        style={{ marginBottom: "10px" }}
        onClick={onShowParams}
      >
        параметры
      </button>
    </div>
  );
};

export default FacingForm;









