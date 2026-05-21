import { useCallback } from "react";
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
 *     template, profileStep (лаги пола), facingProfileStep (облицовка/перегородки),
 *     dFrame, currentConstr, currentGkla/Wool, unvisible).
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
  profileStep: 400,
  facingProfileStep: 600,
  dFrame: false,
  currentConstr: "",
  ConstrToCalcToSent: [],
  ConstrToCalc: [],
  materialsByConstruction: [],
};

export const useCalculatorStore = create(
  persist(
    (set) => ({
      ...initialState,

      /** Универсальный setter: принимает значение или (prev) => next — как useState. */
      setField: (key, v) =>
        set((state) => ({
          [key]: typeof v === "function" ? v(state[key]) : v,
        })),

      /** Полный сброс состояния (например при «Сделать КП» если захотим очищать). */
      reset: () => set(initialState),
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
 * Подписка только на одно поле — изменение других ключей не ре-рендерит компонент.
 */
export function useCalcField(key) {
  const value = useCalculatorStore((state) => state[key]);
  const setValue = useCallback(
    (v) => useCalculatorStore.getState().setField(key, v),
    [key]
  );
  return [value, setValue];
}
