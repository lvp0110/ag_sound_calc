import { useMemo, useState } from "react";
import { pricePerM2List } from "../data/moscowPricePerM2ByArticle";
import { formatRub } from "./tables/MaterialsList";
import "./PricePage.css";

function formatPriceCell(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return formatRub(Number(value));
}

const PricePage = () => {
  const [query, setQuery] = useState("");

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
                <tr key={row.article}>
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
