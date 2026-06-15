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

/** PATCH /api/admin/users/:id/password — задать новый пароль пользователю. */
export const changeUserPassword = (id, password) =>
  request(`/api/admin/users/${id}/password`, { method: "PATCH", body: { password } });

/** PATCH /api/admin/users/:id/block — заблокировать/разблокировать пользователя. */
export const setUserBlocked = (id, isBlocked) =>
  request(`/api/admin/users/${id}/block`, {
    method: "PATCH",
    body: { is_blocked: isBlocked },
  });

/**
 * POST /api/uploads/logo — загрузка логотипа компании (multipart, поле `file`).
 * Возвращает `{ url }` — относительный путь `/uploads/<filename>`, который
 * кладётся в `logo_url` компании и сохраняется через createCompany/updateCompany.
 */
export const uploadLogo = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return request("/api/uploads/logo", { method: "POST", body: fd });
};
