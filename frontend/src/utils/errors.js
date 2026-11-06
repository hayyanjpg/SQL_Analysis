/**
 * errors.js
 * Ambil pesan error yang ramah pengguna dari response FastAPI / Axios.
 */

export function getErrorMessage(error) {
  if (!error?.response) {
    return "Tidak dapat terhubung ke backend. Pastikan server FastAPI berjalan di http://127.0.0.1:8000 dan CORS mengizinkan origin ini.";
  }

  const detail = error.response.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg ?? JSON.stringify(item)).join(" • ");
  }

  return `Backend mengembalikan status ${error.response.status}.`;
}
