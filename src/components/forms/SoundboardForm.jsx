import React from "react";

/**
 * Форма ввода размеров для звукобордов
 */
const SoundboardForm = ({ constR, onLenXChange, onLenYChange, onLenZChange, isVertical = false }) => {
  return (
    <div className="inputsFloorAll">
      <h4 style={{ margin: "5px" }}>размер конструкции</h4>
      {isVertical ? (
        <>
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
        </>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
};

export default SoundboardForm;











