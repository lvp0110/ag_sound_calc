import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { cloneOffer, listOffers } from "../services/offersApi";
import "./KpList.css";

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function KpList() {
  const navigate = useNavigate();
  const { isAuthed, status, openLoginModal } = useAuth();
  const [offers, setOffers] = useState([]);
  const [loadStatus, setLoadStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [cloningId, setCloningId] = useState(null);

  const load = useCallback(async () => {
    setLoadStatus("loading");
    setError(null);
    try {
      const data = await listOffers();
      setOffers(Array.isArray(data) ? data : []);
      setLoadStatus("loaded");
    } catch (err) {
      if (err?.status === 401) {
        setLoadStatus("forbidden");
      } else {
        setError(err?.message || "Не удалось загрузить список.");
        setLoadStatus("error");
      }
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!isAuthed) {
      openLoginModal();
      setLoadStatus("forbidden");
      return;
    }
    load();
  }, [isAuthed, status, openLoginModal, load]);

  const handleClone = async (id) => {
    setCloningId(id);
    try {
      const res = await cloneOffer(id);
      if (res?.id) navigate(`/kp/${res.id}`);
    } catch (err) {
      setError(err?.message || "Не удалось скопировать оффер.");
    } finally {
      setCloningId(null);
    }
  };

  if (status === "loading" || loadStatus === "loading") {
    return (
      <div className="kp-list">
        <p className="kp-list__empty">Загрузка...</p>
      </div>
    );
  }

  if (loadStatus === "forbidden") {
    return (
      <div className="kp-list">
        <p className="kp-list__empty">Войдите, чтобы увидеть свои КП.</p>
      </div>
    );
  }

  return (
    <div className="kp-list">
      <div className="kp-list__header">
        <h1 className="kp-list__title">Мои КП</h1>
        <button
          type="button"
          className="kp-list__new-btn"
          onClick={() => navigate("/calc")}
        >
          Новое КП
        </button>
      </div>

      {error && <div className="kp-list__error" role="alert">{error}</div>}

      {offers.length === 0 ? (
        <p className="kp-list__empty">Пока нет ни одного КП. Начните с калькулятора.</p>
      ) : (
        <table className="kp-list__table">
          <thead>
            <tr>
              <th>Заголовок / Объект</th>
              <th>Регион</th>
              <th>Дата КП</th>
              <th>Обновлено</th>
              <th className="kp-list__actions-col">Действия</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => (
              <tr key={o.id}>
                <td>
                  <button
                    type="button"
                    className="kp-list__link"
                    onClick={() => navigate(`/kp/${o.id}`)}
                  >
                    {o.title || o.object_name || "(без названия)"}
                  </button>
                </td>
                <td>{o.region || "—"}</td>
                <td>{o.kp_date || "—"}</td>
                <td>{formatDate(o.updated_at)}</td>
                <td className="kp-list__actions">
                  <button
                    type="button"
                    className="kp-list__action-btn"
                    onClick={() => handleClone(o.id)}
                    disabled={cloningId === o.id}
                  >
                    {cloningId === o.id ? "Копирование..." : "Создать на основе"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
