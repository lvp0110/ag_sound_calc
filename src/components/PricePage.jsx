import { useMemo, useState } from "react";
import { pricePerM2List } from "../data/moscowPricePerM2ByArticle";
import { formatRub } from "./tables/MaterialsList";
import {
  CALCULATOR_STATE_STORAGE_KEY,
  migrateAdditionalMaterialsFromSavedState,
} from "../constants/calculatorSession";
import "./PricePage.css";

function formatPriceCell(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return formatRub(Number(value));
}

const PricePage = () => {
  const [query, setQuery] = useState("");

  const addRowToAdditionalMaterials = (row) => {
    const primaryPrice = Number(row.pricePerM2);
    const unitPrice = Number(row.pricePerUnit);
    const hasPrimaryPrice = Number.isFinite(primaryPrice);
    const hasUnitPrice = Number.isFinite(unitPrice);
    const nextRow = {
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `mat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: row.name?.trim() || String(row.article ?? ""),
      price: hasPrimaryPrice
        ? String(row.pricePerM2)
        : hasUnitPrice
          ? String(row.pricePerUnit)
          : "",
      quantity: "",
      unit: hasPrimaryPrice ? "м²" : hasUnitPrice ? "ед." : "",
    };

    try {
      const raw = sessionStorage.getItem(CALCULATOR_STATE_STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      const currentRows = migrateAdditionalMaterialsFromSavedState(saved);
      const nextRows = [...currentRows, nextRow];
      sessionStorage.setItem(
        CALCULATOR_STATE_STORAGE_KEY,
        JSON.stringify({
          ...saved,
          additionalMaterials: nextRows,
        })
      );
    } catch {
      // ignore storage errors
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pricePerM2List;
    return pricePerM2List.filter((row) => {
      const art = String(row.article).toLowerCase();
      const name = String(row.name ?? "").toLowerCase();
      return art.includes(q) || name.includes(q);
    });
  }, [query]);

  return (
    <div className="price-page">
      <main className="price-page__main">
        <h1 className="price-page__title">Прайс</h1>
        <p className="price-page__subtitle">
          Ориентировочные наименования и цены по прайсу Москва (руб./м² и
          руб./ед., где указано). Обновление — скриптом{" "}
          <code className="price-page__code">extract-moscow-prices.mjs</code>{" "}
          в файл{" "}
          <code className="price-page__code">moscowPricePerM2ByArticle.js</code>
          .
        </p>

        <label className="price-page__search-label" htmlFor="price-search">
          Поиск по артикулу или наименованию
        </label>
        <input
          id="price-search"
          className="price-page__search"
          type="search"
          autoComplete="off"
          placeholder="Артикул или слово из названия, например Sylomer или 16965"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="price-page__table-wrap">
          <table className="price-page__table">
            <thead>
              <tr>
                <th scope="col">Артикул</th>
                <th scope="col">Наименование</th>
                <th scope="col">₽ / м²</th>
                <th scope="col">₽ / ед.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.article}
                  className="price-page__row-clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => addRowToAdditionalMaterials(row)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      addRowToAdditionalMaterials(row);
                    }
                  }}
                  aria-label={`Добавить материал ${row.name?.trim() || row.article} в дополнительные материалы`}
                >
                  <td className="price-page__article">{row.article}</td>
                  <td className="price-page__name">
                    {row.name?.trim() ? row.name : "—"}
                  </td>
                  <td>{formatPriceCell(row.pricePerM2)}</td>
                  <td>{formatPriceCell(row.pricePerUnit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <p className="price-page__empty">Ничего не найдено.</p>
        )}
      </main>
    </div>
  );
};

export default PricePage;
