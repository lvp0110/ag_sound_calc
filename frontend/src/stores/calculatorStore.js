import { useCallback, useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Глобальный стор калькулятора. Сохраняется в sessionStorage — состояние
 * живёт до закрытия вкладки, но переживает переходы между /calc, /kp/:id,
 * /kp/list и т.д. При открытии в новой вкладке — чистый стейт.
 *
 * Хранятся только поля, которые имеет смысл переживать навигацию:
 *   - накопленные конструкции (ConstrToCalc, ConstrToCalcToSent, materialsByConstruction);
 *   - табличное состояние (tableConstrToCalc);
 *   - выбор пользователя в UI (currentSubCategory/Items, openedSubCategories,
 *     template, profileStep, dFrame, currentConstr, currentGkla/Wool, unvisible).
 *
 * Эфемерные вещи (текущая форма нового элемента `constR`/`constrSent`/`opening`,
 * лоадеры, модалки) остаются useState в компоненте.
 */

const initialState = {
  currentGkla: "default",
  currentWool: "default",
  unvisible: false,
  tableConstrToCalc: null,
  currentSubCategory: 0,
  currentItems: 0,
  openedSubCategories: { F: null, C: null, L: null, W: null },
  template: null,
  profileStep: 600,
  dFrame: false,
  currentConstr: "",
  ConstrToCalcToSent: [],
  ConstrToCalc: [],
  materialsByConstruction: [],
};

export const useCalculatorStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      /** Универсальный setter: принимает значение или (prev) => next — как useState. */
      setField: (key, v) =>
        set((state) => ({
          [key]: typeof v === "function" ? v(state[key]) : v,
        })),

      /** Полный сброс состояния (например при «Сделать КП» если захотим очищать). */
      reset: () => set(initialState),

      /** Для отладки из devtools. */
      _debug: () => get(),
    }),
    {
      name: "ag_calc_store_v1",
      storage: createJSONStorage(() => sessionStorage),
      // не пишем в storage функции и initial-only поля
      partialize: (state) =>
        Object.fromEntries(
          Object.keys(initialState).map((k) => [k, state[k]])
        ),
    }
  )
);

/**
 * Хук в стиле useState для поля стора — drop-in замена:
 *   const [currentGkla, setCurrentGkla] = useCalcField("currentGkla");
 *
 * Использует useSyncExternalStore, чтобы React корректно ре-рендерил
 * подписчиков при изменениях извне (в т.ч. из persist при гидратации).
 */
export function useCalcField(key) {
  const subscribe = useCallback(
    (cb) => useCalculatorStore.subscribe(cb),
    []
  );
  const getSnapshot = useCallback(
    () => useCalculatorStore.getState()[key],
    [key]
  );
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setValue = useCallback(
    (v) => useCalculatorStore.getState().setField(key, v),
    [key]
  );
  return [value, setValue];
}
