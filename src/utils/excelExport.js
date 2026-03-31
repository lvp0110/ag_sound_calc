import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/**
 * Экспорт таблиц в Excel файл
 */
export const exportTablesToExcel = async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("My Sheet");

  const addTableDataToSheet = (tableId) => {
    const table = document.getElementById(tableId);
    if (!table) return;
    const rows = table.querySelectorAll("tr");

    rows[0].querySelectorAll("th").forEach((th, index) => {
      const cell = worksheet.getCell(1, index + 1);
      cell.value = th.innerText;
      cell.font = { bold: true, color: { argb: "FF000000" } };
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

  addTableDataToSheet("table1");
  addTableDataToSheet("table2");

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
export const copyMaterialsToClipboard = () => {
  const table = document.getElementById("table2");
  if (!table) return;
  const rows = table.querySelectorAll("tr");
  let textToCopy = "";

  for (let i = 2; i < rows.length; i++) {
    const cells = rows[i].querySelectorAll("td");
    if (cells.length > 0 && cells[0].innerText.trim() === "---") {
      continue;
    }
    const rowText = [];
    // Копируем для ERP: артикул, наименование, количество (колонки цены и ед.изм не включаем)
    const isDesktopWide = cells.length >= 7;
    const indices = isDesktopWide ? [0, 1, 3] : [0, 2];
    for (const j of indices) {
      if (cells[j]) rowText.push(cells[j].innerText);
    }
    textToCopy += rowText.join("\t") + "\n";
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











