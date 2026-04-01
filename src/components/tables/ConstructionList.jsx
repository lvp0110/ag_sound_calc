
/**
 * Таблица со списком конструкций
 * @param {boolean} [readOnly] — без колонки удаления (например, страница КП)
 */
const ConstructionList = ({
  constructions,
  onDelete = () => {},
  readOnly = false,
}) => {
  if (!constructions || constructions.length === 0) {
    return null;
  }

  const titleColSpan = readOnly ? 3 : 5;

  return (
    <div className="tbl-in">
      <table className="data" id="table1">
        <thead>
          <tr>
            <th
              colSpan={titleColSpan}
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







