/**
 * supabase.js
 * Klien Supabase untuk login (email magic link/OTP dan Google).
 *
 * Kunci yang dipakai adalah publishable/anon key, bukan service key. Nilainya
 * memang aman ada di browser; isolasi data tetap ditegakkan backend.
 */

import { createClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

export const supabaseConfigured = Boolean(url && anonKey);

/**
 * Deteksi tautan pemulihan kata sandi SEBELUM supabase-js membaca dan
 * membersihkan hash URL. Dipakai App untuk menampilkan layar "atur kata sandi
 * baru" ketika pengguna datang dari email reset.
 */
export const initialPasswordRecovery =
  typeof window !== "undefined" &&
  /(^|[#&?])type=recovery(&|=|$)/.test(window.location.hash || window.location.search);

/**
 * Pesan kesalahan dari tautan email yang kedaluwarsa/tidak valid, supaya
 * pengguna tidak hanya melihat halaman masuk kosong tanpa penjelasan.
 */
export const initialAuthError = (() => {
  if (typeof window === "undefined") return "";
  const source = `${window.location.hash || ""}${window.location.search || ""}`;
  const match = /(?:^|[#&?])error_description=([^&]+)/.exec(source);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1].replace(/\+/g, " "));
  } catch {
    return "";
  }
})();

export const supabase = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** Alamat yang dipakai Supabase untuk mengembalikan pengguna setelah login. */
export function authRedirectUrl() {
  if (typeof window === "undefined") return undefined;
  return window.location.origin;
}
