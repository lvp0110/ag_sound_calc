import { request, requestRawResponse } from "./apiClient.js";

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

/** DELETE /api/offers/:id — удалить оффер. 204 без тела. */
export const deleteOffer = (id) =>
  request(`/api/offers/${encodeURIComponent(id)}`, { method: "DELETE" });

/**
 * POST /api/uploads/logo — загрузка картинки логотипа на бэк.
 *
 * Параметр `file` — `File` (из `<input type="file">` или drag-n-drop).
 * Бэк применяет content-addressed дедуп: одинаковые байты → один и тот же URL.
 * Возвращает `{ url }` — относительный путь вида `/uploads/<filename>`.
 * Этот URL нужно положить в `form.logoUrl` и сохранить КП через updateOffer.
 *
 * apiClient уже умеет FormData (см. apiClient.js: instanceof FormData), так что
 * не указываем Content-Type вручную — fetch выставит multipart boundary сам.
 */
export const uploadLogo = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return request("/api/uploads/logo", { method: "POST", body: fd });
};

/**
 * GET /api/offers/:id/pdf — генерирует PDF КП на бэке и инициирует скачивание.
 *
 * `recipient` («кому адресовано») — транзитный параметр: уходит query-строкой,
 * в БД не сохраняется, влияет только на вступительную фразу PDF.
 *
 * Не идём через общий request()/parseResponse: тот ждёт JSON, а нам нужен
 * Blob. credentials: 'include' — httpOnly cookie уйдут как обычно. Имя файла
 * берём из Content-Disposition (RFC 5987 filename* для кириллицы); если бэк
 * не отдал — используем дефолт.
 */
export async function downloadOfferPdf(id, fallbackFilename = "КП.pdf", recipient = "") {
  const query =
    recipient && recipient.trim() !== ""
      ? `?recipient=${encodeURIComponent(recipient.trim())}`
      : "";
  const response = await requestRawResponse(
    `/api/offers/${encodeURIComponent(id)}/pdf${query}`,
    {
      method: "GET",
      headers: { accept: "application/pdf" },
    }
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const error = new Error(
      text ? `PDF generation failed: ${text}` : `PDF generation failed (HTTP ${response.status})`
    );
    error.status = response.status;
    throw error;
  }
  const blob = await response.blob();
  const filename = parseFilenameFromContentDisposition(
    response.headers.get("content-disposition")
  ) || fallbackFilename;
  triggerBlobDownload(blob, filename);
}

function parseFilenameFromContentDisposition(header) {
  if (!header) return "";
  // RFC 5987: filename*=UTF-8''<url-encoded>
  const star = /filename\*=([^;]+)/i.exec(header);
  if (star) {
    const value = star[1].trim();
    const m = /^[Uu][Tt][Ff]-8''(.+)$/.exec(value);
    if (m) {
      try {
        return decodeURIComponent(m[1]);
      } catch {
        return m[1];
      }
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : "";
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Освобождаем URL чуть позже — некоторые браузеры дёргают его асинхронно.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
