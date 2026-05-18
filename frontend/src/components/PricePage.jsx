import { Fragment, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatRub } from "./tables/MaterialsList";
import { setPriceRegion, usePriceData } from "../services/priceApi";
import { filterPriceRows } from "./priceSearch";
import { useOfferEditSession } from "../stores/offerEditSessionStore.js";
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

function getPriceRowKey(row, region) {
  return `${row.article}-${region || "default"}`;
}

function PriceRowDetailCard({ row, selectedRegion }) {
  return (
    <div className="price-page__detail-card">
      <p className="price-page__detail-name">
        {row.name?.trim() ? row.name : "—"}
      </p>
      <dl className="price-page__detail-meta">
        <div className="price-page__detail-meta-row">
          <dt>Артикул</dt>
          <dd>{row.article ?? "—"}</dd>
        </div>
        <div className="price-page__detail-meta-row">
          <dt>₽ / м²</dt>
          <dd>
            {formatPriceCell(
              getPriceByRegion(row, selectedRegion, "pricePerM2")
            )}
          </dd>
        </div>
        <div className="price-page__detail-meta-row">
          <dt>₽ / ед.</dt>
          <dd>
            {formatPriceCell(
              getPriceByRegion(row, selectedRegion, "pricePerUnit")
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function newMaterialRowFromPrice(row, selectedRegion) {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `mat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const pricePerUnit = getPriceByRegion(row, selectedRegion, "pricePerUnit");
  const pricePerM2 = getPriceByRegion(row, selectedRegion, "pricePerM2");
  const price =
    pricePerUnit != null && !Number.isNaN(Number(pricePerUnit))
      ? pricePerUnit
      : pricePerM2;
  return {
    id,
    name: row.name?.trim() ? row.name : String(row.article ?? ""),
    price: price != null && !Number.isNaN(Number(price)) ? String(price) : "",
    quantity: "",
    unit: "",
    sourceArticle: row.article ? String(row.article) : "",
  };
}

const PricePage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [expandedRowKey, setExpandedRowKey] = useState(null);
  const {
    isEditingDraft,
    activeOfferId,
    selectedPriceArticles,
    togglePriceArticle,
    kpSnapshot,
    updateKpSnapshotMaterialRows,
  } = useOfferEditSession();
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

  const selectedSet = useMemo(
    () => new Set(selectedPriceArticles),
    [selectedPriceArticles]
  );

  const addRowToAdditionalMaterials = (row) => {
    if (!isEditingDraft) {
      try {
        navigator.clipboard?.writeText(String(row.article ?? row.name ?? ""));
      } catch {
        // ignore
      }
      return;
    }

    const article = String(row.article ?? "").trim();
    if (!article) return;

    const wasSelected = selectedSet.has(article);
    togglePriceArticle(article);

    const baseRows = kpSnapshot?.materialRows?.length
      ? kpSnapshot.materialRows
      : [{ id: "empty", name: "", price: "", quantity: "", unit: "" }];

    let nextRows;
    if (wasSelected) {
      nextRows = baseRows.filter(
        (r) => String(r.sourceArticle ?? "").trim() !== article
      );
      if (nextRows.length === 0) {
        nextRows = [
          {
            id: `mat-${Date.now()}`,
            name: "",
            price: "",
            quantity: "",
            unit: "",
          },
        ];
      }
    } else {
      const withoutEmpty = baseRows.filter(
        (r) => r.name?.trim() || r.price?.trim() || r.quantity?.trim()
      );
      nextRows = [...withoutEmpty, newMaterialRowFromPrice(row, selectedRegion)];
    }

    updateKpSnapshotMaterialRows(nextRows);
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
        {isEditingDraft && (
          <p className="price-page__draft-hint">
            Выбранные позиции подсвечены и попадут в блок «Дополнительные
            материалы» КП.{" "}
            <button
              type="button"
              className="price-page__return-kp"
              onClick={() => navigate(`/kp/${activeOfferId}`)}
            >
              Вернуться в КП
            </button>
          </p>
        )}
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
          placeholder="Артикул или название"
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
              {filtered.map((row) => {
                const article = String(row.article ?? "").trim();
                const rowKey = getPriceRowKey(row, selectedRegion);
                const isExpanded = expandedRowKey === rowKey;
                const isSelected =
                  isEditingDraft && article && selectedSet.has(article);
                const rowClassName = [
                  isSelected ? "price-page__row--selected" : "",
                  isExpanded ? "price-page__row--expanded" : "",
                ]
                  .filter(Boolean)
                  .join(" ") || undefined;

                return (
                  <Fragment key={rowKey}>
                    <tr
                      className={rowClassName}
                      onClick={() =>
                        setExpandedRowKey((prev) =>
                          prev === rowKey ? null : rowKey
                        )
                      }
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedRowKey((prev) =>
                            prev === rowKey ? null : rowKey
                          );
                        }
                      }}
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
                      <td>
                        <button
                          type="button"
                          className={`price-page__add-button${
                            isSelected
                              ? " price-page__add-button--selected"
                              : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            addRowToAdditionalMaterials(row);
                          }}
                          aria-label={`${
                            isSelected ? "Снять выбор" : "Выбрать"
                          } материал ${row.name?.trim() || row.article}`}
                        >
                          {isSelected ? "Выбрано" : "Выбрать"}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="price-page__detail-row">
                        <td className="price-page__detail-cell" colSpan={5}>
                          <PriceRowDetailCard
                            row={row}
                            selectedRegion={selectedRegion}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default PricePage;
