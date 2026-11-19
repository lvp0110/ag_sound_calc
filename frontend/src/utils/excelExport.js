import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { convertUnits, filterVariable } from "./formatters";
import {
  areaM2FromConstructionLike,
  formatMaterialQuantity,
  isAggregatedPackMaterial,
  materialDisplayUnits,
} from "./materialPackUnits";

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

function materialDisplayName(material) {
  const name =
    material?.Name != null
      ? String(material.Name).trim()
      : material?.name != null
        ? String(material.name).trim()
        : "";
  return name !== "" ? name : "—";
}

function materialQuantityForExport(material, areaM2) {
  if (isAggregatedPackMaterial(material)) {
    return formatMaterialQuantity(material, { areaM2 });
  }
  return convertUnits(material);
}

/**
 * Экспорт таблиц в Excel файл.
 * Материалы берём из materialsByConstruction (в UI они часто свёрнуты и отсутствуют в DOM).
 */
export const exportTablesToExcel = async ({
  materialsByConstruction,
  constructions,
} = {}) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("My Sheet");

  const addTableDataToSheet = (table) => {
    if (!table) return;
    const exportTitle = table.getAttribute("data-export-section-title");
    if (exportTitle) {
      const pre = worksheet.addRow([exportTitle]);
      pre.font = { bold: true, color: { argb: "FF000000" } };
    }

    const rows = table.querySelectorAll("tr");
    if (rows.length === 0) {
      worksheet.addRow([]);
      return;
    }

    const exportAllRows = table.getAttribute("data-export-all-rows") === "true";
    if (exportAllRows) {
      rows.forEach((tr) => {
        const data = [];
        tr.querySelectorAll("th,td").forEach((cell) =>
          data.push(cell.innerText)
        );
        const row = worksheet.addRow(data);
        row.font = { bold: true, color: { argb: "FF000000" } };
      });
      worksheet.addRow([]);
      return;
    }

    const headerCells = rows[0].querySelectorAll("th");
    const headerData = [];
    headerCells.forEach((th) => headerData.push(th.innerText));
    const headerRow = worksheet.addRow(headerData);
    headerRow.font = { bold: true, color: { argb: "FF000000" } };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDCDCDC" },
      };
    });

    for (let i = 1; i < rows.length; i++) {
      const data = [];
      const cells = rows[i].querySelectorAll("th,td");
      cells.forEach((td) => data.push(td.innerText));
      worksheet.addRow(data);
    }

    worksheet.addRow([]);
  };

  const addStyledHeaderRow = (cells) => {
    const headerRow = worksheet.addRow(cells);
    headerRow.font = { bold: true, color: { argb: "FF000000" } };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDCDCDC" },
      };
    });
    return headerRow;
  };

  const addMaterialsSection = (sectionTitle, materials, areaM2) => {
    if (!Array.isArray(materials) || materials.length === 0) return;

    const titleRow = worksheet.addRow([sectionTitle]);
    titleRow.font = { bold: true, color: { argb: "FF000000" } };
    addStyledHeaderRow(["артикул", "название", "ед.изм", "кол-во"]);

    for (const material of materials) {
      worksheet.addRow([
        filterVariable(material?.Code),
        materialDisplayName(material),
        materialDisplayUnits(material, { forKp: false }),
        materialQuantityForExport(material, areaM2),
      ]);
    }
    worksheet.addRow([]);
  };

  const addMaterialsFromData = () => {
    if (!Array.isArray(materialsByConstruction)) return false;

    const order =
      Array.isArray(constructions) && constructions.length > 0
        ? constructions
        : materialsByConstruction.map((entry) => ({
            key_id: entry.key_id,
            ag_id: entry.key_id,
          }));

    let wroteAny = false;
    order.forEach((constr, index) => {
      const matEntry = materialsByConstruction.find(
        (m) => m.key_id === constr.key_id
      );
      const materialsData = matEntry?.data ?? [];
      if (!Array.isArray(materialsData) || materialsData.length === 0) return;

      const { withArticle, noArticle } =
        splitMaterialsByArticleDisplay(materialsData);
      if (withArticle.length === 0 && noArticle.length === 0) return;

      const heading =
        String(constr.title ?? "").trim() ||
        String(constr.ag_id ?? "").trim() ||
        `Конструкция ${index + 1}`;
      const headingRow = worksheet.addRow([heading]);
      headingRow.font = { bold: true, color: { argb: "FF000000" } };

      const areaM2 = areaM2FromConstructionLike(constr);
      addMaterialsSection("Материалы конструкции", withArticle, areaM2);
      addMaterialsSection("Общестроительные материалы", noArticle, areaM2);
      wroteAny = true;
    });

    return wroteAny;
  };

  const table1 = document.getElementById("table1");
  addTableDataToSheet(table1);

  const wroteFromData = addMaterialsFromData();
  if (!wroteFromData) {
    const materialTables = document.querySelectorAll(
      '[data-materials-table="true"]'
    );
    if (materialTables.length > 0) {
      materialTables.forEach((t) => addTableDataToSheet(t));
    } else {
      addTableDataToSheet(document.getElementById("table2"));
    }
  }

  addTableDataToSheet(document.getElementById("table-grand-total"));

  worksheet.eachRow({ includeEmpty: true }, function (row) {
    row.eachCell({ includeEmpty: true }, function (cell) {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  worksheet.columns.forEach(function (column) {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, function (cell) {
      const columnLength = cell.value ? cell.value.toString().length : 0;
      maxLength = Math.max(maxLength, columnLength + 2);
    });
    column.width = maxLength < 10 ? 10 : maxLength;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, "Tables.xlsx");
};

/**
 * Копирование таблицы материалов в буфер обмена
 */
const appendTableRowsForErp = (table, textToCopy) => {
  const rows = table.querySelectorAll("tr");
  const startRow = parseInt(
    table.getAttribute("data-erp-data-start-row") || "2",
    10
  );
  for (let i = startRow; i < rows.length; i++) {
    const cells = rows[i].querySelectorAll("td");
    if (cells.length > 0 && cells[0].innerText.trim() === "---") {
      continue;
    }
    const rowText = [];
    const isDesktopWide = cells.length >= 7;
    const indices = isDesktopWide ? [0, 1, 3] : [0, 2];
    for (const j of indices) {
      if (cells[j]) rowText.push(cells[j].innerText);
    }
    textToCopy += rowText.join("\t") + "\n";
  }
  return textToCopy;
};

export const copyMaterialsToClipboard = () => {
  const tables = document.querySelectorAll('[data-materials-table="true"]');
  const list =
    tables.length > 0
      ? Array.from(tables)
      : [document.getElementById("table2")].filter(Boolean);
  if (list.length === 0) return;

  let textToCopy = "";
  for (const table of list) {
    textToCopy = appendTableRowsForErp(table, textToCopy);
  }

  navigator.clipboard
    .writeText(textToCopy)
    .then(() => {
      alert(
        "Данные скопированы в буфер обмена. Для получения расчета конструкций необходимо вставить данные в ERP/Заказ клиента/Товары/Заполнить/Загрузить из внешнего файла/Артикул "
      );
    })
    .catch(() => {
      // Игнорируем ошибки копирования
    });
};
