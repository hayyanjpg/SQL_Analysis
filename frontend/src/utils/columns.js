/**
 * columns.js
 * Deteksi tipe kolom berdasarkan nama kolom + isi baris.
 * Dipakai bersama oleh grafik (ResultChart) dan tabel (DataTable) supaya
 * keputusan format dan pemilihan sumbu selalu konsisten.
 */

const MONEY_HINTS =
  /(amount|revenue|price|harga|total|subtotal|penjualan|pembelian|pendapatan|omzet|biaya|cost|salary|gaji|sales|nilai)/i;

const NON_MONEY_HINTS =
  /(qty|quantity|count|jumlah|(^|_)id($|_)|rating|score|persen|percent|percentage|ratio|rasio|stock|stok)/i;

const PERCENT_HINTS =
  /(persen|percent|percentage|pct|ratio|rasio|margin|(^|_)rate($|_)|\brate\b)/i;

const AVERAGE_HINTS = /(avg|average|rata|mean|median)/i;

const ADDITIVE_HINTS =
  /(total|amount|revenue|subtotal|qty|quantity|count|jumlah|penjualan|pembelian|pendapatan|omzet)/i;

const ID_HINTS = /^(id|.*_id)$/i;

const TEMPORAL_NAME_HINTS =
  /(date|tanggal|time|waktu|bulan|month|year|tahun|created|updated|period|periode)/i;

const ISO_DATE =
  /^\d{4}-\d{2}(-\d{2})?([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/** True jika nama kolom berupa id (id, customer_id, sale_id, ...). */
export function isIdLike(key) {
  return ID_HINTS.test(String(key ?? ""));
}

/** True jika kolom berisi nilai uang. */
export function isMoneyColumn(key) {
  const name = String(key ?? "");
  return MONEY_HINTS.test(name) && !NON_MONEY_HINTS.test(name);
}

/** True jika kolom berisi persentase/rasio. */
export function isPercentColumn(key) {
  return PERCENT_HINTS.test(String(key ?? ""));
}

/**
 * Strategi agregasi saat satu label muncul lebih dari sekali.
 * - kolom rata-rata/rating/harga -> avg
 * - kolom aditif (total, qty, jumlah) -> sum
 * - sisanya -> sum agar tidak menghilangkan nilai
 */
export function aggregationFor(key) {
  const name = String(key ?? "");
  if (AVERAGE_HINTS.test(name)) return "avg";
  if (ADDITIVE_HINTS.test(name)) return "sum";
  // Metrik non-aditif (harga, stok, rating): menjumlahkan duplikat menyesatkan.
  return "avg";
}

/**
 * True jika semua nilai non-null berupa angka finite.
 * Null tidak dianggap merusak kolom, hanya dilewati saat agregasi.
 */
export function isNumericColumn(rows, key) {
  if (!Array.isArray(rows) || rows.length === 0) return false;

  let numbers = 0;
  for (const row of rows) {
    const value = row?.[key];
    if (value === null || value === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) return false;
    numbers += 1;
  }

  return numbers > 0;
}

/**
 * Versi toleran untuk grafik: minimal 80% nilai non-null berupa angka.
 * Satu sel kosong/aneh tidak lagi mematikan grafik.
 */
export function isChartNumeric(rows, key) {
  if (!Array.isArray(rows) || rows.length === 0) return false;

  let filled = 0;
  let numbers = 0;
  for (const row of rows) {
    const value = row?.[key];
    if (value === null || value === undefined) continue;
    filled += 1;
    if (typeof value === "number" && Number.isFinite(value)) numbers += 1;
  }

  return filled > 0 && numbers / filled >= 0.8;
}

/** True jika kolom berisi tanggal/waktu (ISO string atau nama kolom waktu). */
export function isTemporalColumn(key, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return false;

  const values = [];
  for (const row of rows) {
    const value = row?.[key];
    if (value === null || value === undefined || value === "") continue;
    values.push(value);
  }

  if (values.length === 0) return false;

  if (values.every((value) => typeof value === "string" && ISO_DATE.test(value))) {
    return true;
  }

  if (!TEMPORAL_NAME_HINTS.test(String(key ?? ""))) return false;

  return values.every((value) => {
    if (typeof value === "number") return value >= 1900 && value <= 2200;
    if (typeof value !== "string") return false;
    return !Number.isNaN(Date.parse(value));
  });
}
