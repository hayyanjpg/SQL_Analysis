/**
 * api.js
 * Satu sumber kebenaran untuk URL backend dan kunci akses.
 *
 * Prioritas konfigurasi URL:
 * 1. VITE_API_BASE_URL  -> base tanpa path (mis. http://127.0.0.1:8000)
 * 2. VITE_API_URL       -> kompatibilitas lama, boleh berisi /api/ask
 * 3. default cerdas     -> localhost memakai 127.0.0.1:8000,
 *                          domain publik memakai backend Vercel.
 */

import axios from "axios";

/** Backend yang dipakai saat situs diakses dari domain publik. */
export const PRODUCTION_API_BASE = "https://sql-analysis-el64.vercel.app";

function detectDefaultBase() {
  if (typeof window === "undefined" || !window.location?.hostname) {
    return "http://127.0.0.1:8000";
  }

  const host = window.location.hostname;
  const isLocal =
    host === "localhost" || host === "127.0.0.1" || host === "::1";

  return isLocal ? "http://127.0.0.1:8000" : PRODUCTION_API_BASE;
}

const RAW_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  detectDefaultBase();

export const API_BASE = RAW_BASE.replace(/\/+$/, "").replace(
  /\/api\/ask$/i,
  ""
);

export const ENDPOINTS = {
  ask: `${API_BASE}/api/ask`,
  tables: `${API_BASE}/api/tables`,
  upload: `${API_BASE}/api/upload`,
  executeConfirmed: `${API_BASE}/api/execute_confirmed`,
  authCheck: `${API_BASE}/api/auth/check`,
  health: `${API_BASE}/api/health`,
};

/**
 * Batas ukuran file, disamakan dengan validasi backend.
 * Di Vercel, badan request dibatasi 4.5 MB, jadi default-nya 4 MB. Nilai ini
 * bisa dinaikkan lewat VITE_MAX_UPLOAD_MB / VITE_MAX_SQL_MB bila backend
 * dijalankan di host tanpa batas 4.5 MB (mis. lokal atau VPS).
 */
function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const MAX_UPLOAD_MB = positiveNumber(import.meta.env.VITE_MAX_UPLOAD_MB, 4);
const MAX_SQL_MB = positiveNumber(import.meta.env.VITE_MAX_SQL_MB, 4);

export const FILE_LIMITS_MB = {
  ".csv": MAX_UPLOAD_MB,
  ".xlsx": MAX_UPLOAD_MB,
  ".xls": MAX_UPLOAD_MB,
  ".sql": MAX_SQL_MB,
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
