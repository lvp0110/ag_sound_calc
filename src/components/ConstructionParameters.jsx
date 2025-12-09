import React from "react";
import { getMaxLenZInMeters } from "../utils/validation";

/**
 * Компонент параметров конструкции (гипсокартон, минвата, шаг профиля, проемы)
 */
const ConstructionParameters = ({
  selectedItem,
  currentSubCategory,
  currentGkla,
  setCurrentGkla,
  currentWool,
  setCurrentWool,
  profileStep,
  setProfileStep,
  dFrame,
  setDFrame,
  opening,
  setOpening,
  openings,
  onAddOpening,
  onDeleteOpening,
}) => {
  const isZIPSFacing =
    selectedItem?.ag_id &&
    selectedItem.ag_id.startsWith("AG.Z") &&
    selectedItem.c_id == "L";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        top: "10px",
        marginBottom: "20px",
        width: "100%",
      }}
    >
      <h4
        style={{
          background: "lightgray",
          padding: 4,
        }}
      >
        выбрать тип гипсокартона
      </h4>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "4px",
        }}
      >
        <input
          className="radio"
          type="radio"
          onChange={(e) => setCurrentGkla(e.target.value)}
          id={`gkla_default_${selectedItem.id}`}
          name={`gkla_${selectedItem.id}`}
          value="default"
          checked={currentGkla == "default"}
        />
        <label
          className="label"
          htmlFor={`gkla_default_${selectedItem.id}`}
        >
          AKU-line 2500x1200x12,5 мм
        </label>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "4px",
        }}
      >
        <input
          className="radio"
          type="radio"
          onChange={(e) => setCurrentGkla(e.target.value)}
          id={`gkla_2500P_${selectedItem.id}`}
          name={`gkla_${selectedItem.id}`}
          value="2500P"
          checked={currentGkla == "2500P"}
        />
        <label
          className="label"
          htmlFor={`gkla_2500P_${selectedItem.id}`}
        >
          AKU-line Pro 2500x1200x12,5 мм
        </label>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "4px",
        }}
      >
        <input
          className="radio"
          type="radio"
          onChange={(e) => setCurrentGkla(e.target.value)}
          id={`gkla_2000_${selectedItem.id}`}
          name={`gkla_${selectedItem.id}`}
          value="2000"
          checked={currentGkla == "2000"}
        />
        <label
          className="label"
          htmlFor={`gkla_2000_${selectedItem.id}`}
        >
          AKU-line 2000x1200x12,5 мм
        </label>
      </div>

      {!isZIPSFacing && (
        <>
          <h4
            style={{
              background: "lightgray",
              padding: 4,
            }}
          >
            выбрать тип минваты
          </h4>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "4px",
            }}
          >
            <input
              className="radio"
              type="radio"
              onChange={(e) => setCurrentWool(e.target.value)}
              id={`wool_default_${selectedItem.id}`}
              name={`wool_${selectedItem.id}`}
              value="default"
              checked={currentWool == "default"}
            />
            <label
              className="label"
              htmlFor={`wool_default_${selectedItem.id}`}
            >
              Шуманет-Эко
            </label>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "4px",
            }}
          >
            <input
              className="radio"
              type="radio"
              onChange={(e) => setCurrentWool(e.target.value)}
              id={`wool_bm_${selectedItem.id}`}
              name={`wool_${selectedItem.id}`}
              value="bm"
              checked={currentWool == "bm"}
            />
            <label
              className="label"
              htmlFor={`wool_bm_${selectedItem.id}`}
            >
              Шуманет-БМ
            </label>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "4px",
            }}
          >
            <input
              className="radio"
              type="radio"
              onChange={(e) => setCurrentWool(e.target.value)}
              id={`wool_sk_${selectedItem.id}`}
              name={`wool_${selectedItem.id}`}
              value="skNeo"
              checked={currentWool == "skNeo"}
            />
            <label
              className="label"
              htmlFor={`wool_sk_${selectedItem.id}`}
            >
              Шуманет-СК Neo
            </label>
          </div>
        </>
      )}

      {!isZIPSFacing && (
        <>
          <h4
            style={{
              background: "lightgray",
              padding: 4,
            }}
          >
            шаг профиля
          </h4>
          <div
            style={{
              fontSize: "12px",
              color: "#666",
              marginBottom: "5px",
            }}
          >
            ✔ шаг профиля при облицовке керамической плиткой не более 400 мм
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "4px",
            }}
          >
            <input
              className="radio"
              type="radio"
              onChange={(e) => setProfileStep(Number(e.target.value))}
              id={`step600_${selectedItem.id}`}
              name={`steps_${selectedItem.id}`}
              value="600"
              checked={profileStep === 600}
            />
            <label
              className="label"
              htmlFor={`step600_${selectedItem.id}`}
            >
              шаг профиля 600 мм{" "}
              {(() => {
                const maxHeight = getMaxLenZInMeters(
                  selectedItem.id,
                  600,
                  currentSubCategory
                );
                return maxHeight
                  ? `(макс.высота конструкции ${maxHeight} м)`
                  : "";
              })()}
            </label>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "4px",
            }}
          >
            <input
              className="radio"
              type="radio"
              onChange={(e) => setProfileStep(Number(e.target.value))}
              id={`step400_${selectedItem.id}`}
              name={`steps_${selectedItem.id}`}
              value="400"
              checked={profileStep === 400}
            />
            <label
              className="label"
              htmlFor={`step400_${selectedItem.id}`}
            >
              шаг профиля 400 мм{" "}
              {(() => {
                const maxHeight = getMaxLenZInMeters(
                  selectedItem.id,
                  400,
                  currentSubCategory
                );
                return maxHeight
                  ? `(макс.высота конструкции ${maxHeight} м)`
                  : "";
              })()}
            </label>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "4px",
            }}
          >
            <input
              className="radio"
              type="radio"
              onChange={(e) => setProfileStep(Number(e.target.value))}
              id={`step300_${selectedItem.id}`}
              name={`steps_${selectedItem.id}`}
              value="300"
              checked={profileStep === 300}
            />
            <label
              className="label"
              htmlFor={`step300_${selectedItem.id}`}
            >
              шаг профиля 300 мм{" "}
              {(() => {
                const maxHeight = getMaxLenZInMeters(
                  selectedItem.id,
                  300,
                  currentSubCategory
                );
                return maxHeight
                  ? `(макс.высота конструкции ${maxHeight} м)`
                  : "";
              })()}
            </label>
          </div>
        </>
      )}

      {!isZIPSFacing && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "4px",
          }}
        >
          <input
            className="checkbox"
            type="checkbox"
            onChange={(e) => setDFrame(e.target.checked)}
            id={`dframe_${selectedItem.id}`}
            checked={dFrame}
          />
          <label className="label" htmlFor={`dframe_${selectedItem.id}`}>
            добавить сдвоенный каркас
          </label>
        </div>
      )}

      <h4
        style={{
          background: "lightgray",
          padding: 4,
        }}
      >
        размер проема
      </h4>
      <input
        type="number"
        placeholder="ширина проема,мм"
        value={opening.lenX || ""}
        onChange={(e) =>
          setOpening({
            ...opening,
            lenX: e.target.value,
          })
        }
      />
      <input
        type="number"
        placeholder="высота проема,мм"
        value={opening.lenZ || ""}
        onChange={(e) =>
          setOpening({
            ...opening,
            lenZ: e.target.value,
          })
        }
      />
      <h4 style={{ margin: "1px" }}>тип проема</h4>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "4px",
        }}
      >
        <input
          className="radio"
          type="radio"
          onChange={(e) =>
            setOpening({
              ...opening,
              Type: e.target.value,
            })
          }
          id={`doors_${selectedItem.id}`}
          name={`opening_${selectedItem.id}`}
          value="OST_Doors"
          checked={opening.Type == "OST_Doors"}
        />
        <label
          className="label"
          htmlFor={`doors_${selectedItem.id}`}
        >
          дверь
        </label>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "4px",
        }}
      >
        <input
          className="radio"
          type="radio"
          onChange={(e) =>
            setOpening({
              ...opening,
              Type: e.target.value,
            })
          }
          id={`wind_${selectedItem.id}`}
          name={`opening_${selectedItem.id}`}
          value="OST_Windows"
          checked={opening.Type == "OST_Windows"}
        />
        <label
          className="label"
          htmlFor={`wind_${selectedItem.id}`}
        >
          окно
        </label>
      </div>
      <button
        className="counter__button_param"
        style={{ right: "2px" }}
        onClick={onAddOpening}
        disabled={
          !opening.lenX ||
          !opening.lenZ ||
          isNaN(+opening.lenX) ||
          isNaN(+opening.lenZ) ||
          +opening.lenX <= 0 ||
          +opening.lenZ <= 0
        }
      >
        добавить проем
      </button>
      {openings.length > 0 && (
        <div
          className="tbl-in"
          style={{
            marginTop: "10px",
            width: "100%",
          }}
        >
          <table className="data" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th
                  colSpan="3"
                  style={{
                    fontSize: "14px",
                    fontWeight: "bold",
                    textAlign: "center",
                  }}
                >
                  список проемов
                </th>
              </tr>
              <tr>
                <th>тип проема</th>
                <th>размеры, мм</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {openings.map((op, idx) => (
                <tr key={idx}>
                  <td style={{ textAlign: "center" }}>
                    {op.Type == "OST_Doors" ? "дверь" : "окно"}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {op.lenX} x {op.lenZ}
                  </td>
                  <td>
                    <input
                      type="button"
                      className="counter__button_minus"
                      onClick={() => onDeleteOpening(idx)}
                    />
                    <img
                      src={`${import.meta.env.BASE_URL}delete-icon.jpg`}
                      alt=""
                      style={{
                        height: "30px",
                        opacity: 0.7,
                        cursor: "pointer",
                      }}
                      loading="lazy"
                      decoding="async"
                      onClick={() => onDeleteOpening(idx)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ConstructionParameters;







