/**
 * api.js
 * Satu sumber kebenaran untuk URL backend dan kunci akses.
 *
 * Prioritas konfigurasi URL:
 * 1. VITE_API_BASE_URL  -> base tanpa path (mis. http://127.0.0.1:8000)
 * 2. VITE_API_URL       -> kompatibilitas lama, boleh berisi /api/ask
 * 3. default lokal      -> http://127.0.0.1:8000
 */

import axios from "axios";

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
  authCheck: `${API_BASE}/api/auth/check`,
  health: `${API_BASE}/api/health`,
};

/** Batas ukuran file, disamakan dengan validasi backend (MAX_UPLOAD_MB=10). */
export const FILE_LIMITS_MB = {
  ".csv": 10,
  ".xlsx": 10,
  ".xls": 10,
  ".sql": 5,
};

export const ALLOWED_EXTENSIONS = Object.keys(FILE_LIMITS_MB);

/* -------------------------------------------------------------------------
 * Kunci akses bersama
 * Disimpan di localStorage browser. Tidak pernah ikut di-bundle ke publik.
 * ---------------------------------------------------------------------- */

const ACCESS_KEY_STORAGE = "sift.accessKey";

/** Event global agar UI dapat membuka dialog saat backend merespons 401. */
export const UNAUTHORIZED_EVENT = "sift:unauthorized";

export function getAccessKey() {
  try {
    return window.localStorage.getItem(ACCESS_KEY_STORAGE) || "";
  } catch {
    return "";
  }
}

export function saveAccessKey(key) {
  const value = String(key ?? "").trim();

  try {
    if (value) {
      window.localStorage.setItem(ACCESS_KEY_STORAGE, value);
    } else {
      window.localStorage.removeItem(ACCESS_KEY_STORAGE);
    }
  } catch {
    // localStorage bisa diblokir (mode privat); kunci tetap dipakai di sesi ini
    // lewat header pada request berikutnya? Tidak — tanpa storage kunci hilang.
  }

  return value;
}

/**
 * Interceptor dipasang sekali saat modul ini diimpor. Semua pemanggilan axios
 * (termasuk dari komponen) otomatis membawa X-API-Key bila tersedia.
 */
let interceptorsReady = false;

if (!interceptorsReady) {
  interceptorsReady = true;

  axios.interceptors.request.use((config) => {
    const key = getAccessKey();
    if (key) {
      config.headers = config.headers ?? {};
      config.headers["X-API-Key"] = key;
    }
    return config;
  });

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error?.response?.status === 401) {
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      }
      return Promise.reject(error);
    }
  );
}

/** Verifikasi kunci ke backend tanpa menyimpannya lebih dulu. */
export async function verifyAccessKey(key) {
  const value = String(key ?? "").trim();
  if (!value) throw new Error("Kunci akses tidak boleh kosong.");

  await axios.get(ENDPOINTS.authCheck, {
    headers: { "X-API-Key": value },
    timeout: 30000,
  });

  return value;
}
