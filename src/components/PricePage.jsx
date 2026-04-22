import { useMemo, useState } from "react";
import { formatRub } from "./tables/MaterialsList";
import { getRegionLabel, setPriceRegion, usePriceData } from "../services/priceApi";
import {
  CALCULATOR_STATE_STORAGE_KEY,
  migrateAdditionalMaterialsFromSavedState,
} from "../constants/calculatorSession";
import { filterPriceRows } from "./priceSearch";
import "./PricePage.css";

function formatPriceCell(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return formatRub(Number(value));
}

function getPriceByRegion(row, region, key) {
  if (!row) return undefined;
  const regional = region ? row.regionalPrices?.[region]?.[key] : undefined;
  if (regional != null) return regional;
  return row[key];
}

let fallbackMaterialIdCounter = 0;

function nextMaterialRowId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  fallbackMaterialIdCounter += 1;
  return `mat-${fallbackMaterialIdCounter}`;
}

const PricePage = () => {
  const [query, setQuery] = useState("");
  const {
    list: priceList,
    loaded,
    loading,
    error,
    regions,
    selectedRegion,
  } = usePriceData();

  const addRowToAdditionalMaterials = (row) => {
    const pricePerM2 = getPriceByRegion(row, selectedRegion, "pricePerM2");
    const pricePerUnit = getPriceByRegion(row, selectedRegion, "pricePerUnit");
    const primaryPrice = Number(pricePerM2);
    const unitPrice = Number(pricePerUnit);
    const hasPrimaryPrice = Number.isFinite(primaryPrice);
    const hasUnitPrice = Number.isFinite(unitPrice);
    const nextRow = {
      id: nextMaterialRowId(),
      name: row.name?.trim() || String(row.article ?? ""),
      price: hasPrimaryPrice
        ? String(pricePerM2)
        : hasUnitPrice
          ? String(pricePerUnit)
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
    return filterPriceRows(priceList, query);
  }, [query, priceList]);

  return (
    <div className="price-page">
      <main className="price-page__main">
        <h1 className="price-page__title">Прайс</h1>
        <p className="price-page__subtitle">
          Ориентировочные наименования и цены по выбранному региону (руб./м² и
          руб./ед., где указано). Источник: API{" "}
          <code className="price-page__code">/api/v2/data</code>.
        </p>
        {loading && !loaded && (
          <p className="price-page__subtitle">Загрузка прайса...</p>
        )}
        {error && (
          <p className="price-page__empty">
            Не удалось загрузить прайс: {error}
          </p>
        )}

        <label className="price-page__search-label" htmlFor="price-region">
          Регион
        </label>
        <select
          id="price-region"
          className="price-page__search price-page__region-select"
          value={selectedRegion}
          onChange={(e) => setPriceRegion(e.target.value)}
          disabled={regions.length === 0}
        >
          {regions.length === 0 ? (
            <option value="">Регионы не найдены</option>
          ) : (
            regions.map((region) => (
              <option key={region} value={region}>
                {getRegionLabel(region)}
              </option>
            ))
          )}
        </select>

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
                  key={`${row.article}-${selectedRegion || "default"}`}
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
                  <td>
                    {formatPriceCell(
                      getPriceByRegion(row, selectedRegion, "pricePerM2")
                    )}
                  </td>
                  <td>
                    {formatPriceCell(
                      getPriceByRegion(row, selectedRegion, "pricePerUnit")
                    )}
                  </td>
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
