import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Сессия редактирования черновика КП (только для авторизованных).
 * Пока isDraft === true, закрыть КП можно только через «Сохранить».
 * Разрешена навигация на /calc и /price для добавления позиций.
 */
const initialState = {
  activeOfferId: null,
  isDraft: false,
  /** Снимок KpPage при уходе в калькулятор/прайс (форма, услуги, доп. материалы, монтаж). */
  kpSnapshot: null,
  /** Артикулы, выбранные в прайсе (подсветка строк). */
  selectedPriceArticles: [],
};

export const useOfferEditSessionStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      startDraft: (offerId) =>
        set({
          activeOfferId: offerId,
          isDraft: true,
          kpSnapshot: null,
          selectedPriceArticles: [],
        }),

      stashKpSnapshot: (snapshot) =>
        set((state) => ({
          ...state,
          kpSnapshot: snapshot,
        })),

      setSelectedPriceArticles: (articles) =>
        set({ selectedPriceArticles: Array.isArray(articles) ? articles : [] }),

      togglePriceArticle: (article) => {
        const key = String(article ?? "").trim();
        if (!key) return;
        set((state) => {
          const setArticles = new Set(state.selectedPriceArticles);
          if (setArticles.has(key)) setArticles.delete(key);
          else setArticles.add(key);
          return { selectedPriceArticles: [...setArticles] };
        });
      },

      updateKpSnapshotMaterialRows: (materialRows) =>
        set((state) => ({
          kpSnapshot: state.kpSnapshot
            ? { ...state.kpSnapshot, materialRows }
            : { materialRows },
        })),

      clearSession: () => set(initialState),

      isPathAllowedDuringDraft: (pathname) => {
        const { activeOfferId, isDraft } = get();
        if (!isDraft || !activeOfferId) return true;
        const base = (pathname || "").split("?")[0];
        if (base === "/calc" || base.startsWith("/calc/")) return true;
        if (base === "/price") return true;
        if (base === `/kp/${activeOfferId}`) return true;
        return false;
      },
    }),
    {
      name: "ag_offer_edit_session_v1",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        activeOfferId: state.activeOfferId,
        isDraft: state.isDraft,
        kpSnapshot: state.kpSnapshot,
        selectedPriceArticles: state.selectedPriceArticles,
      }),
    }
  )
);

export function useOfferEditSession() {
  const activeOfferId = useOfferEditSessionStore((s) => s.activeOfferId);
  const isDraft = useOfferEditSessionStore((s) => s.isDraft);
  const kpSnapshot = useOfferEditSessionStore((s) => s.kpSnapshot);
  const selectedPriceArticles = useOfferEditSessionStore((s) => s.selectedPriceArticles);
  const startDraft = useOfferEditSessionStore((s) => s.startDraft);
  const stashKpSnapshot = useOfferEditSessionStore((s) => s.stashKpSnapshot);
  const clearSession = useOfferEditSessionStore((s) => s.clearSession);
  const togglePriceArticle = useOfferEditSessionStore((s) => s.togglePriceArticle);
  const setSelectedPriceArticles = useOfferEditSessionStore(
    (s) => s.setSelectedPriceArticles
  );
  const updateKpSnapshotMaterialRows = useOfferEditSessionStore(
    (s) => s.updateKpSnapshotMaterialRows
  );
  const isPathAllowedDuringDraft = useOfferEditSessionStore(
    (s) => s.isPathAllowedDuringDraft
  );

  return {
    activeOfferId,
    isDraft,
    isEditingDraft: isDraft && Boolean(activeOfferId),
    kpSnapshot,
    selectedPriceArticles,
    startDraft,
    stashKpSnapshot,
    clearSession,
    togglePriceArticle,
    setSelectedPriceArticles,
    updateKpSnapshotMaterialRows,
    isPathAllowedDuringDraft,
  };
}
