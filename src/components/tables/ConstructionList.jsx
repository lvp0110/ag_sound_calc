import { filterVariable } from "../../utils/formatters";
import MaterialsList, {
  computeGrandTotalRubForConstructions,
  computeTotalRubForMaterialsData,
  formatRub,
  montageLineProductRub,
} from "./MaterialsList";

/** Строка итога «Стоимость конструкций» (экспорт для КП: итог после блока «Услуги»). */
export function ConstructionGrandTotalBlock({
  readOnly,
  grandTotalRub,
  /** Итог монтажа по КП (передаётся только на странице КП). */
  montageGrandTotalRub,
  wrapClassName = "",
}) {
  const titleColSpan = readOnly ? 3 : 4;
  const grandTotalCardClass = readOnly ? " kp-table-card" : "";
  const cellTopBorder = readOnly
    ? {}
    : {
        borderTop: "2px solid var(--table-border, #ccc)",
        paddingTop: "12px",
        paddingBottom: "8px",
      };
  const showMontageRow = montageGrandTotalRub !== undefined;
  return (
    <div
      className={`tbl-in construction-grand-total-wrap${grandTotalCardClass}${
        wrapClassName ? ` ${wrapClassName}` : ""
      }`}
    >
      <table className="data" id="table-grand-total">
        <thead>
          <tr>
            <th
              colSpan={Math.max(1, titleColSpan - 1)}
              style={{
                fontWeight: "bold",
                textAlign: "left",
                ...cellTopBorder,
              }}
            >
              Стоимость конструкций
            </th>
            <th
              style={{
                fontWeight: "bold",
                textAlign: "right",
                whiteSpace: "nowrap",
                ...cellTopBorder,
              }}
            >
              {formatRub(grandTotalRub)}
            </th>
          </tr>
          {showMontageRow && (
            <tr className="construction-grand-total-montage-row">
              <th
                colSpan={Math.max(1, titleColSpan - 1)}
                style={{
                  fontWeight: "bold",
                  textAlign: "left",
                  ...(readOnly
                    ? {}
                    : {
                        paddingTop: "10px",
                        paddingBottom: "8px",
                      }),
                }}
              >
                Стоимость монтажа
              </th>
              <th
                style={{
                  fontWeight: "bold",
                  textAlign: "right",
                  whiteSpace: "nowrap",
                  ...(readOnly
                    ? {}
                    : {
                        paddingTop: "10px",
                        paddingBottom: "8px",
                      }),
                }}
              >
                {formatRub(montageGrandTotalRub)}
              </th>
            </tr>
          )}
        </thead>
      </table>
    </div>
  );
}

/** Размер в мм для ячейки таблицы */
function formatConstructionMm(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return String(n);
}

/**
 * Вторая величина: для стен/перегородок — высота (lenZ), для пола/потолка — длина (lenY).
 */
function constructionHeightMm({ lenY, lenZ }) {
  const z = lenZ != null && lenZ !== "" ? Number(lenZ) : NaN;
  if (!Number.isNaN(z) && z > 0) return lenZ;
  return lenY;
}

/** Как в колонке «артикул»: без цифры в начале кода показывается «---». */
function splitMaterialsByArticleDisplay(materials) {
  if (!Array.isArray(materials)) return { withArticle: [], noArticle: [] };
  const withArticle = [];
  const noArticle = [];
  for (const m of materials) {
    if (filterVariable(m.Code) === "---") noArticle.push(m);
    else withArticle.push(m);
  }
  return { withArticle, noArticle };
}

/**
 * Таблица со списком конструкций
 * @param {boolean} [readOnly] — без колонки удаления (например, страница КП)
 * @param {Array<{ key_id: number, data: unknown[] }>} [materialsByConstruction] — если задано, под каждой конструкцией выводится свой список материалов (без суммирования между конструкциями)
 * @param {boolean} [showGeneralConstructionMaterials=true] — блок «Общестроительные материалы» (без артикула)
 * @param {(ctx: { key_id: number, cardIndex: number }) => import("react").ReactNode} [renderKpMontageSlot] — раздел «Монтаж» в каждой карточке конструкции на КП (не в «Услугах» и не в строке итога)
 * @param {Record<number, { price?: string, quantity?: string, unit?: string }>} [montageByKeyId] — монтаж по карточке (КП); для итога под карточкой
 */
const ConstructionList = ({
  constructions,
  onDelete = () => {},
  readOnly = false,
  materialsByConstruction,
  showGeneralConstructionMaterials = true,
  renderKpMontageSlot,
  montageByKeyId,
  /** На КП итог выводится отдельным блоком ниже «Услуги». */
  showGrandTotalInline = true,
}) => {
  if (!constructions || constructions.length === 0) {
    return null;
  }

  /** Режим «конструкция → под ней материалы» (массив может быть пустым при восстановлении сессии) */
  const interleaved = materialsByConstruction != null;

  if (interleaved) {
    return (
      <div className="construction-materials-blocks">
        {constructions.map((constRItem, index) => {
          const matEntry = materialsByConstruction.find(
            (m) => m.key_id === constRItem.key_id
          );
          const materialsData = matEntry?.data ?? [];
          const { withArticle, noArticle } =
            splitMaterialsByArticleDisplay(materialsData);
          const materialsRubTotal =
            computeTotalRubForMaterialsData(materialsData);
          const montageRubCard = montageLineProductRub(
            montageByKeyId?.[constRItem.key_id]
          );
          const cardSectionsTotalRub =
            materialsRubTotal + (montageRubCard ?? 0);
          const baseTableId = index === 0 ? "table2" : `table2-${index}`;
          const groupBody = (
            <>
              <div className="tbl-in">
                <table className="data" id={index === 0 ? "table1" : undefined}>
                  <thead>
                    <tr>
                      <th
                        colSpan={readOnly ? 5 : 6}
                        style={{ fontWeight: "bold", textAlign: "left" }}
                      >
                        Конструкция
                      </th>
                    </tr>
                    <tr>
                      <th>название</th>
                      <th>шифр</th>
                      <th style={{ textAlign: "center" }}>ширина, мм</th>
                      <th style={{ textAlign: "center" }}>высота, мм</th>
                      <th>масса</th>
                      {!readOnly && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{constRItem.title}</td>
                      <td>{constRItem.ag_id}</td>
                      <td style={{ textAlign: "center" }}>
                        {formatConstructionMm(constRItem.lenX)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {formatConstructionMm(
                          constructionHeightMm(constRItem)
                        )}
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
              {withArticle.length === 0 && noArticle.length === 0 && (
                <MaterialsList
                  data={[]}
                  tableId={baseTableId}
                  collapsible={readOnly}
                />
              )}
              {withArticle.length > 0 && (
                <MaterialsList
                  data={withArticle}
                  tableId={baseTableId}
                  collapsible={readOnly}
                />
              )}
              {showGeneralConstructionMaterials && noArticle.length > 0 && (
                <MaterialsList
                  data={noArticle}
                  tableId={
                    withArticle.length > 0 ? `${baseTableId}-misc` : baseTableId
                  }
                  sectionTitle="Общестроительные материалы"
                  collapsible={readOnly}
                />
              )}
            </>
          );

          return (
            <div
              key={constRItem.key_id}
              className="construction-materials-block"
            >
              {readOnly ? (
                <div className="kp-table-card kp-table-card--group">
                  {groupBody}
                  {typeof renderKpMontageSlot === "function"
                    ? renderKpMontageSlot({
                        key_id: constRItem.key_id,
                        cardIndex: index,
                      })
                    : null}
                  <div className="tbl-in kp-card-sections-total-wrap">
                    <table
                      className="data"
                      id={`kp-card-sections-total-${constRItem.key_id}`}
                      aria-label={`Итого по разделам, карточка ${index + 1}`}
                    >
                      <thead>
                        <tr>
                          <th
                            colSpan={2}
                            style={{
                              fontWeight: "bold",
                              textAlign: "left",
                              borderTop: "2px solid var(--table-border, #ccc)",
                              paddingTop: "12px",
                              paddingBottom: "8px",
                            }}
                          >
                            Итого по разделам
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
                            {formatRub(cardSectionsTotalRub)}
                          </th>
                        </tr>
                      </thead>
                    </table>
                  </div>
                </div>
              ) : (
                groupBody
              )}
            </div>
          );
        })}
        {showGrandTotalInline && (
          <ConstructionGrandTotalBlock
            readOnly={readOnly}
            grandTotalRub={computeGrandTotalRubForConstructions(
              constructions,
              materialsByConstruction
            )}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={
        readOnly
          ? "tbl-in kp-table-card"
          : "tbl-in"
      }
    >
      <table className="data" id="table1">
        <thead>
          <tr>
            <th>шифр</th>
            <th>название</th>
            <th style={{ textAlign: "center" }}>ширина, мм</th>
            <th style={{ textAlign: "center" }}>высота, мм</th>
            <th>масса</th>
            {!readOnly && <th></th>}
          </tr>
        </thead>
        <tbody>
          {constructions.map((constRItem) => (
            <tr key={constRItem.key_id}>
              <td style={{ textAlign: "right" }}>{constRItem.ag_id}</td>
              <td style={{ textAlign: "center" }}>{constRItem.title}</td>
              <td style={{ textAlign: "center" }}>
                {formatConstructionMm(constRItem.lenX)}
              </td>
              <td style={{ textAlign: "center" }}>
                {formatConstructionMm(constructionHeightMm(constRItem))}
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
