import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

// Номер счётчика публичный; VITE_YANDEX_METRIKA_ID можно переопределить при сборке.
const COUNTER_ID =
  Number(import.meta.env.VITE_YANDEX_METRIKA_ID) || 112388350;

function ensureMetrikaLoaded(id) {
  if (typeof window === "undefined") return;

  // Официальный loader tag.js — ставит stub `ym` сразу, скрипт грузится async.
  (function (m, e, t, r, i, k, a) {
    m[i] =
      m[i] ||
      function () {
        (m[i].a = m[i].a || []).push(arguments);
      };
    m[i].l = 1 * new Date();
    for (let j = 0; j < document.scripts.length; j += 1) {
      if (document.scripts[j].src === r) return;
    }
    k = e.createElement(t);
    a = e.getElementsByTagName(t)[0];
    k.async = 1;
    k.src = r;
    a.parentNode.insertBefore(k, a);
  })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

  window.ym(id, "init", {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true,
  });
}

/**
 * Яндекс.Метрика для SPA: init один раз + hit на смену маршрута React Router.
 * Включается только в production и только если задан VITE_YANDEX_METRIKA_ID.
 */
export default function YandexMetrika() {
  const location = useLocation();
  const initializedRef = useRef(false);
  const skipFirstHitRef = useRef(true);

  useEffect(() => {
    if (!COUNTER_ID || !import.meta.env.PROD || initializedRef.current) return;
    ensureMetrikaLoaded(COUNTER_ID);
    initializedRef.current = true;
  }, []);

  useEffect(() => {
    if (!COUNTER_ID || !import.meta.env.PROD || typeof window.ym !== "function") {
      return;
    }
    // Первый просмотр уже учитывает init — не дублируем hit.
    if (skipFirstHitRef.current) {
      skipFirstHitRef.current = false;
      return;
    }
    const url = `${location.pathname}${location.search}${location.hash}`;
    window.ym(COUNTER_ID, "hit", url);
  }, [location.pathname, location.search, location.hash]);

  return null;
}
