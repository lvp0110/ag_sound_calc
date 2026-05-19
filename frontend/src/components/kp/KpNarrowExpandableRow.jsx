import { Fragment } from "react";
import { KpNarrowRowDetail } from "./KpNarrowRowDetail";

/**
 * Обёртка строки таблицы КП: на узком экране по клику раскрывает карточку с полями.
 */
export function KpNarrowExpandableRow({
  rowKey,
  expandedKey,
  onToggleRow,
  narrow,
  colSpan,
  children,
  detailTitle,
  detailFields,
}) {
  const isExpanded = narrow && expandedKey === rowKey;

  const rowProps = narrow
    ? {
        className: `kp-narrow-row--clickable${
          isExpanded ? " kp-narrow-row--expanded" : ""
        }`,
        onClick: () => onToggleRow(rowKey),
        role: "button",
        tabIndex: 0,
        "aria-expanded": isExpanded,
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleRow(rowKey);
          }
        },
      }
    : {};

  return (
    <Fragment>
      <tr {...rowProps}>{children}</tr>
      {isExpanded && detailFields?.length > 0 && (
        <tr className="kp-narrow-detail-row">
          <td colSpan={colSpan} className="kp-narrow-detail-cell">
            <KpNarrowRowDetail title={detailTitle} fields={detailFields} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}
