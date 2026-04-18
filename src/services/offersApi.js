import { request } from "./apiClient.js";

/**
 * POST /api/offers — { form, offerDraft } → полный Offer DTO c пересчитанными materials.
 * form          — метаданные КП (title, manager_name, region, ...)
 * offerDraft    — { constructions: [{ calc_params, materials?, montage? }], services?: [...] }
 */
export const createOffer = (payload) =>
  request("/api/offers", { method: "POST", body: payload });

/** GET /api/offers — список офферов (метаданные, без конструкций). */
export const listOffers = () => request("/api/offers", { method: "GET" });

/** GET /api/offers/:id — оффер с пересчитанными материалами и наложенными override. */
export const getOffer = (id) => request(`/api/offers/${encodeURIComponent(id)}`, { method: "GET" });

/** PATCH /api/offers/:id — частичное обновление (form?, services?, constructions?, total_cost?). */
export const updateOffer = (id, patch) =>
  request(`/api/offers/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });

/** POST /api/offers/:id/clone — дубликат, возвращает { id } нового оффера. */
export const cloneOffer = (id) =>
  request(`/api/offers/${encodeURIComponent(id)}/clone`, { method: "POST" });
