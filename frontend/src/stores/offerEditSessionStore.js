import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useCalculatorStore } from "./calculatorStore.js";

/**
 * Сессия редактирования черновика КП (только для авторизованных).
 * isDraft + activeOfferId — открытая сессия КП (в т.ч. после «Выйти» в список).
 * hasUnsavedChanges — несохранённые правки (бейдж в шапке, блок PDF).
 * Уход в список: кнопка «Выйти» (requestExitToList). «Сохранить» остаётся на КП.
 * Разрешена навигация на /calc и /price для добавления позиций.
 */
const initialState = {
  activeOfferId: null,
  isDraft: false,
  hasUnsavedChanges: false,
  /** Снимок KpPage при уходе в калькулятор/прайс/список без сохранения. */
  kpSnapshot: null,
  /** Артикулы, выбранные в прайсе (подсветка строк). */
  selectedPriceArticles: [],
  /** Одноразовый пропуск OfferDraftGuard для /kp/list (кнопка «Выйти»). */
  allowExitToList: false,
};

export const useOfferEditSessionStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      startDraft: (offerId) =>
        set((state) => {
          if (state.isDraft && state.activeOfferId === offerId) {
            return state;
          }
          const prevId = state.activeOfferId;
          if (prevId != null && prevId !== offerId) {
            useCalculatorStore.getState().reset();
          }
          return {
            activeOfferId: offerId,
            isDraft: true,
            hasUnsavedChanges: true,
            kpSnapshot: null,
            selectedPriceArticles: [],
          };
        }),

      clearKpSnapshot: () => set({ kpSnapshot: null }),

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

      markDraftSaved: () => set({ hasUnsavedChanges: false }),

      markDraftDirty: () =>
        set((state) =>
          state.hasUnsavedChanges ? state : { hasUnsavedChanges: true }
        ),

      /** Кнопка «Выйти» на KpPage — разрешить переход в список без PATCH. */
      requestExitToList: () => set({ allowExitToList: true }),

      consumeExitToList: () =>
        set((state) =>
          state.allowExitToList ? { allowExitToList: false } : state
        ),

      /** PDF только если нет несохранённых правок этого оффера. */
      isOfferPdfExportBlocked: (offerId) => {
        const { hasUnsavedChanges, activeOfferId } = get();
        if (!hasUnsavedChanges || activeOfferId == null || offerId == null) {
          return false;
        }
        return String(activeOfferId) === String(offerId);
      },

      isPathAllowedDuringDraft: (pathname) => {
        const { activeOfferId, isDraft } = get();
        if (!isDraft || !activeOfferId) return true;
        const base = (pathname || "").split("?")[0];
        if (base === "/calc" || base.startsWith("/calc/")) return true;
        if (base === "/price") return true;
        if (base === "/info" || base.startsWith("/info/")) return true;
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
        hasUnsavedChanges: state.hasUnsavedChanges,
        kpSnapshot: state.kpSnapshot,
        selectedPriceArticles: state.selectedPriceArticles,
      }),
    }
  )
);

export function useOfferEditSession() {
  const activeOfferId = useOfferEditSessionStore((s) => s.activeOfferId);
  const isDraft = useOfferEditSessionStore((s) => s.isDraft);
  const hasUnsavedChanges = useOfferEditSessionStore((s) => s.hasUnsavedChanges);
  const kpSnapshot = useOfferEditSessionStore((s) => s.kpSnapshot);
  const selectedPriceArticles = useOfferEditSessionStore(
    (s) => s.selectedPriceArticles
  );
  const startDraft = useOfferEditSessionStore((s) => s.startDraft);
  const stashKpSnapshot = useOfferEditSessionStore((s) => s.stashKpSnapshot);
  const clearKpSnapshot = useOfferEditSessionStore((s) => s.clearKpSnapshot);
  const clearSession = useOfferEditSessionStore((s) => s.clearSession);
  const markDraftSaved = useOfferEditSessionStore((s) => s.markDraftSaved);
  const markDraftDirty = useOfferEditSessionStore((s) => s.markDraftDirty);
  const requestExitToList = useOfferEditSessionStore((s) => s.requestExitToList);
  const consumeExitToList = useOfferEditSessionStore((s) => s.consumeExitToList);
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
  const isOfferPdfExportBlocked = useOfferEditSessionStore(
    (s) => s.isOfferPdfExportBlocked
  );

  const isEditingDraft = isDraft && Boolean(activeOfferId);
  const hasUnsavedKpEdits =
    isEditingDraft && hasUnsavedChanges;

  return {
    activeOfferId,
    isDraft,
    hasUnsavedChanges,
    hasUnsavedKpEdits,
    isEditingDraft,
    kpSnapshot,
    selectedPriceArticles,
    startDraft,
    stashKpSnapshot,
    clearKpSnapshot,
    clearSession,
    markDraftSaved,
    markDraftDirty,
    requestExitToList,
    consumeExitToList,
    togglePriceArticle,
    setSelectedPriceArticles,
    updateKpSnapshotMaterialRows,
    isPathAllowedDuringDraft,
    isOfferPdfExportBlocked,
  };
}
