import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useOfferEditSession } from "../stores/offerEditSessionStore.js";
import {
  cloneOffer,
  createOffer,
  deleteOffer,
  downloadOfferPdf,
  listOffers,
} from "../services/offersApi";
import { getRegionCityLabel } from "../constants/regionSelectOptions.js";
import "./KpList.css";

function formatRegionCell(region) {
  const label = getRegionCityLabel(region);
  return label || "—";
}

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
  const location = useLocation();
  const { isAuthed, status } = useAuth();
  const { isEditingDraft, activeOfferId, startDraft } = useOfferEditSession();
  const [offers, setOffers] = useState([]);
  const [loadStatus, setLoadStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [cloningId, setCloningId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

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
    const autoOpenId =
      location.state?.autoOpenOfferId ||
      (isEditingDraft ? activeOfferId : null);
    if (autoOpenId) {
      navigate(`/kp/${autoOpenId}`, { replace: true });
    }
  }, [location.state, isEditingDraft, activeOfferId, navigate]);

  useEffect(() => {
    if (status === "loading") return;
    if (!isAuthed) {
      // LoginModal не открываем — просто показываем подсказку «войдите».
      // Пользователь сам решит, логиниться или уйти.
      setLoadStatus("forbidden");
      return;
    }
    load();
  }, [isAuthed, status, load]);

  const handleClone = async (id) => {
    setCloningId(id);
    try {
      const res = await cloneOffer(id);
      if (res?.id) {
        startDraft(res.id);
        navigate(`/kp/${res.id}`);
      }
    } catch (err) {
      setError(err?.message || "Не удалось скопировать оффер.");
    } finally {
      setCloningId(null);
    }
  };

  const handleDownloadPdf = async (offer) => {
    if (downloadingId) return;
    setDownloadingId(offer.id);
    setError(null);
    try {
      const objectPart = offer.object_name?.trim() || offer.id;
      await downloadOfferPdf(offer.id, `КП ${objectPart}.pdf`);
    } catch (err) {
      setError(err?.message || "Не удалось сгенерировать PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (offer) => {
    const label = offer.object_name || "без названия";
    if (!window.confirm(`Удалить КП «${label}»? Действие нельзя отменить.`)) {
      return;
    }
    setDeletingId(offer.id);
    setError(null);
    try {
      await deleteOffer(offer.id);
      // удаляем из локального списка, чтобы не перезагружать
      setOffers((prev) => prev.filter((o) => o.id !== offer.id));
    } catch (err) {
      setError(err?.message || "Не удалось удалить КП.");
    } finally {
      setDeletingId(null);
    }
  };

  /**
   * «Новое КП»: создаёт пустой оффер (без конструкций) и редиректит на /kp/:id.
   * Пользователь заполнит форму и добавит конструкции через калькулятор позже.
   */
  const handleNew = async () => {
    if (creatingNew) return;
    setCreatingNew(true);
    setError(null);
    try {
      const offer = await createOffer({
        offerDraft: { constructions: [] },
      });
      if (offer?.id) {
        startDraft(offer.id);
        navigate(`/kp/${offer.id}`);
      }
    } catch (err) {
      setError(err?.message || "Не удалось создать новое КП.");
    } finally {
      setCreatingNew(false);
    }
  };

  const openOffer = (id) => {
    if (isEditingDraft && activeOfferId) {
      navigate(`/kp/${activeOfferId}`);
      return;
    }
    startDraft(id);
    navigate(`/kp/${id}`);
  };

  const renderOfferActions = (o) => (
    <>
      <button
        type="button"
        className="kp-list__action-btn"
        onClick={() => handleDownloadPdf(o)}
        disabled={
          downloadingId === o.id || cloningId === o.id || deletingId === o.id
        }
      >
        {downloadingId === o.id ? "PDF..." : "Скачать PDF"}
      </button>
      <button
        type="button"
        className="kp-list__action-btn"
        onClick={() => handleClone(o.id)}
        disabled={cloningId === o.id || deletingId === o.id}
      >
        {cloningId === o.id ? "Копирование..." : "Создать на основе"}
      </button>
      <button
        type="button"
        className="kp-list__action-btn kp-list__action-btn--danger"
        onClick={() => handleDelete(o)}
        disabled={deletingId === o.id || cloningId === o.id}
        aria-label="Удалить КП"
      >
        {deletingId === o.id ? "Удаление..." : "Удалить"}
      </button>
    </>
  );

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
          onClick={handleNew}
          disabled={creatingNew}
        >
          {creatingNew ? "Создание..." : "Новое КП"}
        </button>
      </div>

      {error && <div className="kp-list__error" role="alert">{error}</div>}

      {offers.length === 0 ? (
        <p className="kp-list__empty">Пока нет ни одного КП. Начните с калькулятора.</p>
      ) : (
        <>
          <div className="kp-list__cards" role="list">
            {offers.map((o, i) => (
              <article key={o.id} className="kp-list__card" role="listitem">
                <div className="kp-list__card-header">
                  <span className="kp-list__card-num">{i + 1}</span>
                  <button
                    type="button"
                    className="kp-list__link kp-list__card-title"
                    onClick={() => openOffer(o.id)}
                  >
                    {o.object_name || "(без названия)"}
                  </button>
                </div>
                <dl className="kp-list__card-meta">
                  <div className="kp-list__card-row">
                    <dt>Регион</dt>
                    <dd>{formatRegionCell(o.region)}</dd>
                  </div>
                  <div className="kp-list__card-row">
                    <dt>Дата КП</dt>
                    <dd>{o.kp_date || "—"}</dd>
                  </div>
                  <div className="kp-list__card-row">
                    <dt>Обновлено</dt>
                    <dd>{formatDate(o.updated_at)}</dd>
                  </div>
                </dl>
                <div className="kp-list__card-actions">{renderOfferActions(o)}</div>
              </article>
            ))}
          </div>

          <table className="kp-list__table">
            <thead>
              <tr>
                <th className="kp-list__num-col">№</th>
                <th>Объект</th>
                <th>Регион</th>
                <th>Дата КП</th>
                <th>Обновлено</th>
                <th className="kp-list__actions-col">Действия</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o, i) => (
                <tr key={o.id}>
                  <td className="kp-list__num-cell">{i + 1}</td>
                  <td>
                    <button
                      type="button"
                      className="kp-list__link"
                      onClick={() => openOffer(o.id)}
                    >
                      {o.object_name || "(без названия)"}
                    </button>
                  </td>
                  <td>{formatRegionCell(o.region)}</td>
                  <td>{o.kp_date || "—"}</td>
                  <td>{formatDate(o.updated_at)}</td>
                  <td className="kp-list__actions">{renderOfferActions(o)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
