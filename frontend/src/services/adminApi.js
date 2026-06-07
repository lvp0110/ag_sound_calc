import { request } from "./apiClient.js";

/** Админ-API (/api/admin/*). Доступно только пользователям с role === 'ADMIN'. */

// ─── Компании ─────────────────────────────────────────────────────────────────

/** GET /api/admin/companies — полный список с числом сотрудников. */
export const listCompanies = () => request("/api/admin/companies", { method: "GET" });

/** POST /api/admin/companies — создать компанию. */
export const createCompany = (body) =>
  request("/api/admin/companies", { method: "POST", body });

/** PATCH /api/admin/companies/:id — обновить реквизиты. */
export const updateCompany = (id, body) =>
  request(`/api/admin/companies/${id}`, { method: "PATCH", body });

/** DELETE /api/admin/companies/:id — удалить (только если нет сотрудников). */
export const deleteCompany = (id) =>
  request(`/api/admin/companies/${id}`, { method: "DELETE" });

// ─── Пользователи ─────────────────────────────────────────────────────────────

/** GET /api/admin/users — список пользователей с компанией и ролью. */
export const listUsers = () => request("/api/admin/users", { method: "GET" });

/** POST /api/admin/users — создать пользователя. */
export const createUser = (body) =>
  request("/api/admin/users", { method: "POST", body });

/** PATCH /api/admin/users/:id — обновить профиль/роль/компанию. */
export const updateUser = (id, body) =>
  request(`/api/admin/users/${id}`, { method: "PATCH", body });
