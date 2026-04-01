import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/**
 * Экспорт таблиц в Excel файл
 */
export const exportTablesToExcel = async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("My Sheet");

  const addTableDataToSheet = (table) => {
    if (!table) return;
    const rows = table.querySelectorAll("tr");
    if (rows.length === 0) return;

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

  const table1 = document.getElementById("table1");
  addTableDataToSheet(table1);

  const materialTables = document.querySelectorAll('[data-materials-table="true"]');
  if (materialTables.length > 0) {
    materialTables.forEach((t) => addTableDataToSheet(t));
  } else {
    addTableDataToSheet(document.getElementById("table2"));
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
  for (let i = 2; i < rows.length; i++) {
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











