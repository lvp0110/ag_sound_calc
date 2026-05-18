import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useOfferEditSession } from "../stores/offerEditSessionStore.js";

/**
 * Блокирует уход с черновика КП на посторонние страницы (без useBlocker —
 * совместимо с BrowserRouter). Разрешены: /calc, /price, /kp/:activeOfferId.
 */
export default function OfferDraftGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isEditingDraft, activeOfferId, isPathAllowedDuringDraft } =
    useOfferEditSession();

  useEffect(() => {
    if (!isEditingDraft || !activeOfferId) return;

    const path = location.pathname;
    if (path === "/kp/list" || !isPathAllowedDuringDraft(path)) {
      navigate(`/kp/${activeOfferId}`, { replace: true });
    }
  }, [
    isEditingDraft,
    activeOfferId,
    location.pathname,
    navigate,
    isPathAllowedDuringDraft,
  ]);

  return null;
}
