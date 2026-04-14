import { filterVariable } from "../../utils/formatters";
import MaterialsList, {
  computeGrandTotalRubForConstructions,
  computeTotalRubForMaterialsData,
  formatRub,
  montageLineProductRub,
} from "./MaterialsList";
import "./ConstructionList.css";

/** Строка итога «Стоимость конструкций» (экспорт для КП: итог после блока «Услуги»). */
export function ConstructionGrandTotalBlock({
  readOnly,
  grandTotalRub,
  /** Итог монтажа по КП (передаётся только на странице КП). */
  montageGrandTotalRub,
  /** Итог доп. услуг по КП (блок «Услуги»). */
  additionalServicesGrandTotalRub,
  wrapClassName = "",
}) {
  const titleColSpan = readOnly ? 3 : 4;
  const grandTotalCardClass = readOnly ? " kp-table-card" : "";
  const showMontageRow = montageGrandTotalRub !== undefined;
  const showServicesRow = additionalServicesGrandTotalRub !== undefined;
  const montagePart =
    typeof montageGrandTotalRub === "number" && !Number.isNaN(montageGrandTotalRub)
      ? montageGrandTotalRub
      : 0;
  const servicesPart =
    typeof additionalServicesGrandTotalRub === "number" &&
    !Number.isNaN(additionalServicesGrandTotalRub)
      ? additionalServicesGrandTotalRub
      : 0;
  const overallTotalRub =
    (typeof grandTotalRub === "number" && !Number.isNaN(grandTotalRub)
      ? grandTotalRub
      : 0) +
    (showMontageRow ? montagePart : 0) +
    (showServicesRow ? servicesPart : 0);

  const lineLabelClass = readOnly
    ? "construction-grand-total__line-label"
    : "construction-grand-total__line-label construction-grand-total__line-label--calc";
  const lineAmountClass = readOnly
    ? "construction-grand-total__line-amount"
    : "construction-grand-total__line-amount construction-grand-total__line-amount--calc";

  return (
    <div
      className={`tbl-in construction-grand-total-wrap${grandTotalCardClass}${
        wrapClassName ? ` ${wrapClassName}` : ""
      }`}
    >
      <table
        className="data"
        id="table-grand-total"
        data-export-all-rows="true"
      >
        <tbody>
          <tr className="construction-grand-total__line construction-grand-total__line--first">
            <th
              colSpan={Math.max(1, titleColSpan - 1)}
              className={lineLabelClass}
            >
              Стоимость конструкций
            </th>
            <th className={lineAmountClass}>{formatRub(grandTotalRub)}</th>
          </tr>
          {showMontageRow && (
            <tr className="construction-grand-total__line construction-grand-total__line--next">
              <th
                colSpan={Math.max(1, titleColSpan - 1)}
                className={lineLabelClass}
              >
                Стоимость монтажа
              </th>
              <th className={lineAmountClass}>
                {formatRub(montageGrandTotalRub)}
              </th>
            </tr>
          )}
          {showServicesRow && (
            <tr className="construction-grand-total__line construction-grand-total__line--next">
              <th
                colSpan={Math.max(1, titleColSpan - 1)}
                className={lineLabelClass}
              >
                Стоимость дополнительных услуг
              </th>
              <th className={lineAmountClass}>
                {formatRub(additionalServicesGrandTotalRub)}
              </th>
            </tr>
          )}
          <tr className="construction-grand-total__total-row">
            <th
              colSpan={Math.max(1, titleColSpan - 1)}
              className={
                readOnly
                  ? "construction-grand-total__total-label"
                  : "construction-grand-total__total-label construction-grand-total__total-label--calc"
              }
            >
              Общий итог
            </th>
            <th
              className={
                readOnly
                  ? "construction-grand-total__total-amount"
                  : "construction-grand-total__total-amount construction-grand-total__total-amount--calc"
              }
            >
              {formatRub(overallTotalRub)}
            </th>
          </tr>
        </tbody>
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

/** Заголовок карточки: название конструкции из строки таблицы. */
function constructionCardHeading({ title, ag_id: code }) {
  if (title != null && String(title).trim() !== "") return String(title).trim();
  if (code != null && String(code).trim() !== "") return String(code).trim();
  return "Конструкция";
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

/** Индексы строк без артикула в исходном `data` карточки (для сопоставления с `noArticle`). */
function noArticleIndicesInMaterialsData(materials) {
  if (!Array.isArray(materials)) return [];
  const idx = [];
  for (let i = 0; i < materials.length; i += 1) {
    if (filterVariable(materials[i].Code) === "---") idx.push(i);
  }
  return idx;
}

/**
 * Таблица со списком конструкций
 * @param {boolean} [readOnly] — без колонки удаления (например, страница КП)
 * @param {Array<{ key_id: number, data: unknown[] }>} [materialsByConstruction] — если задано, под каждой конструкцией выводится свой список материалов (без суммирования между конструкциями)
 * @param {boolean} [showGeneralConstructionMaterials=true] — блок «Общестроительные материалы» (без артикула)
 * @param {(ctx: { key_id: number, cardIndex: number }) => import("react").ReactNode} [renderKpMontageSlot] — раздел «Монтаж» в каждой карточке конструкции на КП (не в «Услугах» и не в строке итога)
 * @param {Record<number, { price?: string, quantity?: string, unit?: string }>} [montageByKeyId] — монтаж по карточке (КП); для итога под карточкой
 * @param {(key_id: number, indexInFullMaterialsData: number, field: 'KpPricePerM2'|'KpPricePerUnit', value: string) => void} [onGeneralMaterialKpPriceChange] — правка цен «Общестроительные материалы»
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
  onGeneralMaterialKpPriceChange,
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
          const miscRowToFullIndex = noArticleIndicesInMaterialsData(
            materialsData
          );
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
                        className="construction-card__heading-th"
                      >
                        {constructionCardHeading(constRItem)}
                      </th>
                    </tr>
                    <tr>
                      {!readOnly && <th className="construction-card__delete-col" />}
                      <th>название</th>
                      <th>шифр</th>
                      <th className="construction-card__dim-th">ширина, мм</th>
                      <th className="construction-card__dim-th">высота, мм</th>
                      <th>масса</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {!readOnly && (
                        <td className="construction-card__delete-col">
                          <input
                            type="button"
                            className="counter__button_minus"
                            onClick={() => onDelete(constRItem.key_id)}
                          />
                          <img
                            src={`${import.meta.env.BASE_URL}delete-icon.jpg`}
                            alt=""
                            className="construction-card__delete-icon"
                            loading="lazy"
                            decoding="async"
                            onClick={() => onDelete(constRItem.key_id)}
                          />
                        </td>
                      )}
                      <td>{constRItem.title}</td>
                      <td>{constRItem.ag_id}</td>
                      <td className="construction-card__dim-td">
                        {formatConstructionMm(constRItem.lenX)}
                      </td>
                      <td className="construction-card__dim-td">
                        {formatConstructionMm(
                          constructionHeightMm(constRItem)
                        )}
                      </td>
                      <td>{constRItem.weight}</td>
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
                  editablePriceCells={readOnly && !!onGeneralMaterialKpPriceChange}
                  onKpMaterialPriceChange={(rowIndex, field, value) => {
                    const fullIdx = miscRowToFullIndex[rowIndex];
                    if (fullIdx === undefined) return;
                    onGeneralMaterialKpPriceChange?.(
                      constRItem.key_id,
                      fullIdx,
                      field,
                      value
                    );
                  }}
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
                      className="data kp-card-sections-total-table"
                      id={`kp-card-sections-total-${constRItem.key_id}`}
                      aria-label={`Итого, карточка ${index + 1}`}
                    >
                      <tbody>
                        <tr>
                          <td className="kp-card-sections-total__cell">
                            <div className="kp-card-sections-total__inner">
                              <span className="kp-card-sections-total__label">
                                Итого
                              </span>
                              <span className="kp-card-sections-total__amount">
                                {formatRub(cardSectionsTotalRub)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      </tbody>
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
            {!readOnly && <th className="construction-card__delete-col" />}
            <th>шифр</th>
            <th>название</th>
            <th className="construction-list-legacy__dim-th">ширина, мм</th>
            <th className="construction-list-legacy__dim-th">высота, мм</th>
            <th>масса</th>
          </tr>
        </thead>
        <tbody>
          {constructions.map((constRItem) => (
            <tr key={constRItem.key_id}>
              {!readOnly && (
                <td className="construction-card__delete-col">
                  <input
                    type="button"
                    className="counter__button_minus"
                    onClick={() => onDelete(constRItem.key_id)}
                  />
                  <img
                    src={`${import.meta.env.BASE_URL}delete-icon.jpg`}
                    alt=""
                    className="construction-card__delete-icon"
                    loading="lazy"
                    decoding="async"
                    onClick={() => onDelete(constRItem.key_id)}
                  />
                </td>
              )}
              <td className="construction-list-legacy__code-td">
                {constRItem.ag_id}
              </td>
              <td className="construction-list-legacy__title-td">
                {constRItem.title}
              </td>
              <td className="construction-list-legacy__dim-td">
                {formatConstructionMm(constRItem.lenX)}
              </td>
              <td className="construction-list-legacy__dim-td">
                {formatConstructionMm(constructionHeightMm(constRItem))}
              </td>
              <td>{constRItem.weight}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ConstructionList;
