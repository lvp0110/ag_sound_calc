import { useMemo, useState } from "react";
import { formatRub } from "./tables/MaterialsList";
import { setPriceRegion, usePriceData } from "../services/priceApi";
import { filterPriceRows } from "./priceSearch";
import "./PricePage.css";

const REGION_SELECT_OPTIONS = [
  { value: "moscow", label: "Москва", regionKey: "msk" },
  { value: "saint-petersburg", label: "Санкт-Петербург", regionKey: "msk" },
  { value: "yekaterinburg", label: "Екатеринбург", regionKey: "ural" },
  { value: "ufa", label: "Уфа", regionKey: "ural" },
  { value: "krasnodar", label: "Краснодар", regionKey: "south" },
  { value: "kazan", label: "Казань", regionKey: "kazan" },
];

const getDefaultRegionOption = (availableRegionKeys) =>
  REGION_SELECT_OPTIONS.find((option) => availableRegionKeys.has(option.regionKey))?.value ??
  "";

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
  const [selectedRegionOption, setSelectedRegionOption] = useState("");

  const availableRegionKeys = useMemo(() => {
    return new Set(regions.map((region) => region.toLowerCase()));
  }, [regions]);

  const visibleRegionOptions = useMemo(() => {
    return REGION_SELECT_OPTIONS.filter((option) =>
      availableRegionKeys.has(option.regionKey)
    );
  }, [availableRegionKeys]);

  const effectiveSelectedRegionOption =
    selectedRegionOption && visibleRegionOptions.some((option) => option.value === selectedRegionOption)
      ? selectedRegionOption
      : getDefaultRegionOption(availableRegionKeys);

  const handleRegionChange = (optionValue) => {
    setSelectedRegionOption(optionValue);
    const selectedOption = REGION_SELECT_OPTIONS.find(
      (option) => option.value === optionValue
    );
    if (!selectedOption) return;
    setPriceRegion(selectedOption.regionKey);
  };

  // TODO: раньше добавляло строку в sessionStorage.calculator_state.additionalMaterials.
  // После перехода на backend-flow такой передачи нет — строка попадает только
  // в локальный клипборд (скопировать артикул). Интеграцию в текущий оффер нужно
  // сделать отдельным этапом (потребует знать offerId контекстно).
  const addRowToAdditionalMaterials = (row) => {
    try {
      navigator.clipboard?.writeText(String(row.article ?? row.name ?? ""));
    } catch {
      // ignore
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
          value={effectiveSelectedRegionOption}
          onChange={(e) => handleRegionChange(e.target.value)}
          disabled={visibleRegionOptions.length === 0}
        >
          {visibleRegionOptions.length === 0 ? (
            <option value="">Регионы не найдены</option>
          ) : (
            visibleRegionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
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
                <th scope="col">Действие</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={`${row.article}-${selectedRegion || "default"}`}>
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
                  <td>
                    <button
                      type="button"
                      className="price-page__add-button"
                      onClick={() => addRowToAdditionalMaterials(row)}
                      aria-label={`Добавить материал ${row.name?.trim() || row.article} в дополнительные материалы`}
                    >
                      Выбрать
                    </button>
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
