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
