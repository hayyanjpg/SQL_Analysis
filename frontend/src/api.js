/**
 * api.js
 * Satu sumber kebenaran untuk URL backend.
 *
 * Prioritas konfigurasi:
 * 1. VITE_API_BASE_URL  -> base tanpa path (mis. http://127.0.0.1:8000)
 * 2. VITE_API_URL       -> kompatibilitas lama, boleh berisi /api/ask
 * 3. default lokal      -> http://127.0.0.1:8000
 */

const RAW_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

export const API_BASE = RAW_BASE.replace(/\/+$/, "").replace(
  /\/api\/ask$/i,
  ""
);

export const ENDPOINTS = {
  ask: `${API_BASE}/api/ask`,
  upload: `${API_BASE}/api/upload`,
  executeConfirmed: `${API_BASE}/api/execute_confirmed`,
};

/** Batas ukuran file, disamakan dengan validasi backend. */
export const FILE_LIMITS_MB = {
  ".csv": 25,
  ".xlsx": 25,
  ".xls": 25,
  ".sql": 5,
};

export const ALLOWED_EXTENSIONS = Object.keys(FILE_LIMITS_MB);
