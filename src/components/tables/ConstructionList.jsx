import MaterialsList, {
  computeTotalRubForMaterialsData,
  formatRub,
} from "./MaterialsList";

/**
 * Таблица со списком конструкций
 * @param {boolean} [readOnly] — без колонки удаления (например, страница КП)
 * @param {Array<{ key_id: number, data: unknown[] }>} [materialsByConstruction] — если задано, под каждой конструкцией выводится свой список материалов (без суммирования между конструкциями)
 */
const ConstructionList = ({
  constructions,
  onDelete = () => {},
  readOnly = false,
  materialsByConstruction,
}) => {
  if (!constructions || constructions.length === 0) {
    return null;
  }

  const titleColSpan = readOnly ? 3 : 4;
  /** Режим «конструкция → под ней материалы» (массив может быть пустым при восстановлении сессии) */
  const interleaved = materialsByConstruction != null;

  if (interleaved) {
    const grandTotalRub = constructions.reduce((sum, constRItem) => {
      const matEntry = materialsByConstruction.find(
        (m) => m.key_id === constRItem.key_id
      );
      return sum + computeTotalRubForMaterialsData(matEntry?.data ?? []);
    }, 0);

    return (
      <div className="construction-materials-blocks">
        {constructions.map((constRItem, index) => {
          const matEntry = materialsByConstruction.find(
            (m) => m.key_id === constRItem.key_id
          );
          const materialsData = matEntry?.data ?? [];
          return (
            <div
              key={constRItem.key_id}
              className="construction-materials-block"
            >
              <div className="tbl-in">
                <table
                  className="data"
                  id={index === 0 ? "table1" : undefined}
                >
                  <thead>
                    <tr>
                      <th>шифр</th>
                      <th>название</th>
                      <th>масса</th>
                      {!readOnly && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ textAlign: "right" }}>{constRItem.ag_id}</td>
                      <td style={{ textAlign: "center" }}>
                        {constRItem.title} , {constRItem.lenX} x {constRItem.lenY}{" "}
                        {constRItem.lenZ} мм
                      </td>
                      <td>{constRItem.weight}</td>
                      {!readOnly && (
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
                            loading="lazy"
                            decoding="async"
                            onClick={() => onDelete(constRItem.key_id)}
                          />
                        </td>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
              <MaterialsList
                data={materialsData}
                tableId={index === 0 ? "table2" : `table2-${index}`}
              />
            </div>
          );
        })}
        <div className="tbl-in construction-grand-total-wrap">
          <table className="data" id="table-grand-total">
            <thead>
              <tr>
                <th
                  colSpan={Math.max(1, titleColSpan - 1)}
                  style={{
                    fontWeight: "bold",
                    textAlign: "left",
                    borderTop: "2px solid var(--table-border, #ccc)",
                    paddingTop: "12px",
                    paddingBottom: "8px",
                  }}
                >
                  Общий итог
                </th>
                <th
                  style={{
                    fontWeight: "bold",
                    textAlign: "right",
                    whiteSpace: "nowrap",
                    borderTop: "2px solid var(--table-border, #ccc)",
                    paddingTop: "12px",
                    paddingBottom: "8px",
                  }}
                >
                  {formatRub(grandTotalRub)}
                </th>
              </tr>
            </thead>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="tbl-in">
      <table className="data" id="table1">
        <thead>
          <tr>
            <th>шифр</th>
            <th>название</th>
            <th>масса</th>
            {!readOnly && <th></th>}
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
              {!readOnly && (
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
                    loading="lazy"
                    decoding="async"
                    onClick={() => onDelete(constRItem.key_id)}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ConstructionList;
