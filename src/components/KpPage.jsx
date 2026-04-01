import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ConstructionList from "./tables/ConstructionList";
import MaterialsList from "./tables/MaterialsList";
import { CALCULATOR_STATE_STORAGE_KEY } from "../constants/calculatorSession";
import "./KpPage.css";
import "./Calculator.css";

function loadCalculatorTablesState() {
  try {
    const raw = sessionStorage.getItem(CALCULATOR_STATE_STORAGE_KEY);
    if (!raw) {
      return {
        tableConstrToCalc: null,
        ConstrToCalc: [],
        calculatedMaterials: { data: [] },
      };
    }
    const s = JSON.parse(raw);
    return {
      tableConstrToCalc: s.tableConstrToCalc ?? null,
      ConstrToCalc: Array.isArray(s.ConstrToCalc) ? s.ConstrToCalc : [],
      calculatedMaterials:
        s.calculatedMaterials && typeof s.calculatedMaterials === "object"
          ? s.calculatedMaterials
          : { data: [] },
    };
  } catch {
    return {
      tableConstrToCalc: null,
      ConstrToCalc: [],
      calculatedMaterials: { data: [] },
    };
  }
}

const initialForm = {
  manager: "",
  phone: "",
  email: "",
  officeAddress: "",
  date: "",
  object: "",
};

const KpPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [calcTables] = useState(loadCalculatorTablesState);
  const [services, setServices] = useState({
    montage: "",
    delivery: "",
  });

  const onFieldChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const onServicePriceChange = (key) => (e) => {
    setServices((prev) => ({ ...prev, [key]: e.target.value }));
  };

  return (
    <div className="kp-page">
      <button
        type="button"
        className="kp-page__back"
        onClick={() => navigate("/calc")}
      >
        ← К калькулятору
      </button>
      <main className="kp-page__main">
        <h1 className="kp-page__title">Коммерческое предложение</h1>

        <section className="kp-page__contact" aria-label="Контактные данные">
          <div className="kp-page__field-row">
            <label className="kp-page__label" htmlFor="kp-manager">
              Менеджер:
            </label>
            <input
              id="kp-manager"
              className="kp-page__input"
              type="text"
              autoComplete="name"
              value={form.manager}
              onChange={onFieldChange("manager")}
            />
          </div>
          <div className="kp-page__field-row">
            <label className="kp-page__label" htmlFor="kp-phone">
              Телефон:
            </label>
            <input
              id="kp-phone"
              className="kp-page__input"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={onFieldChange("phone")}
            />
          </div>
          <div className="kp-page__field-row">
            <label className="kp-page__label" htmlFor="kp-email">
              Email:
            </label>
            <input
              id="kp-email"
              className="kp-page__input kp-page__input--email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={onFieldChange("email")}
            />
          </div>
          <div className="kp-page__field-row">
            <label className="kp-page__label" htmlFor="kp-address">
              Адрес офиса:
            </label>
            <input
              id="kp-address"
              className="kp-page__input"
              type="text"
              autoComplete="street-address"
              value={form.officeAddress}
              onChange={onFieldChange("officeAddress")}
            />
          </div>
          <div className="kp-page__field-row">
            <label className="kp-page__label" htmlFor="kp-date">
              Дата:
            </label>
            <input
              id="kp-date"
              className="kp-page__input"
              type="text"
              value={form.date}
              onChange={onFieldChange("date")}
            />
          </div>
          <div className="kp-page__field-row kp-page__field-row--last">
            <label className="kp-page__label" htmlFor="kp-object">
              Объект:
            </label>
            <input
              id="kp-object"
              className="kp-page__input"
              type="text"
              value={form.object}
              onChange={onFieldChange("object")}
            />
          </div>
        </section>

        <div
          className="tables-and-buttons-container kp-page__tables"
          aria-label="Данные расчёта из калькулятора"
        >
          {calcTables.tableConstrToCalc != null &&
          calcTables.ConstrToCalc.length > 0 ? (
            <>
              <ConstructionList
                constructions={calcTables.ConstrToCalc}
                readOnly
              />
              <MaterialsList
                calculatedMaterials={calcTables.calculatedMaterials}
              />
            </>
          ) : (
            <p className="kp-page__tables-empty">
              В калькуляторе ещё нет расчёта: добавьте конструкции и нажмите
              «расчёт конструкции», затем снова откройте эту страницу.
            </p>
          )}
        </div>

        <div className="tbl-in kp-page__services">
          <table className="data" id="kp-table-services" aria-label="Услуги">
            <thead>
              <tr>
                <th
                  colSpan={2}
                  style={{
                    fontSize: "14px",
                    fontWeight: "bold",
                    textAlign: "center",
                  }}
                >
                  Услуги
                </th>
              </tr>
              <tr>
                <th>Название</th>
                <th>Цена</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Монтаж</td>
                <td>
                  <input
                    id="kp-service-montage"
                    type="text"
                    className="kp-page__services-input"
                    value={services.montage}
                    onChange={onServicePriceChange("montage")}
                    aria-label="Цена, монтаж"
                  />
                </td>
              </tr>
              <tr>
                <td>Доставка</td>
                <td>
                  <input
                    id="kp-service-delivery"
                    type="text"
                    className="kp-page__services-input"
                    value={services.delivery}
                    onChange={onServicePriceChange("delivery")}
                    aria-label="Цена, доставка"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default KpPage;
