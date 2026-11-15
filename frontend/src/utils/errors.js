/**
 * errors.js
 * Ambil pesan error yang ramah pengguna dari response FastAPI / Axios.
 */

import { API_BASE } from "../api";

export function getErrorMessage(error) {
  if (!error?.response) {
    return `Tidak dapat terhubung ke backend (${API_BASE}). Pastikan server berjalan dan CORS mengizinkan origin ini.`;
  }

  const detail = error.response.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg ?? JSON.stringify(item)).join(" • ");
  }

  // Beberapa endpoint mengembalikan detail terstruktur, mis.
  // { code, message, warnings } untuk konfirmasi file .sql berisiko.
  if (detail && typeof detail === "object") {
    if (typeof detail.message === "string" && detail.message.trim()) {
      return detail.message;
    }
    if (typeof detail.msg === "string" && detail.msg.trim()) {
      return detail.msg;
    }
  }

  return `Backend mengembalikan status ${error.response.status}.`;
}
