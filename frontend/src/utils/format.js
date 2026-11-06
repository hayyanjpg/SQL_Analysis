const numberFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Format angka dengan pemisah ribuan Indonesia (53.193.000). */
export function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (typeof value === "number") return numberFormatter.format(value);
  return String(value);
}

/** Format angka ringkas untuk sumbu grafik (53,2 jt). */
export function formatCompact(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return compactFormatter.format(value);
}

/** Format nilai sel tabel secara aman (null, boolean, objek, angka). */
export function formatCell(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return numberFormatter.format(value);
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Ubah snake_case menjadi label yang enak dibaca. */
export function prettyKey(key) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** True jika seluruh nilai pada kolom adalah angka finite. */
export function isNumericColumn(rows, key) {
  return (
    rows.length > 0 &&
    rows.every((row) => typeof row[key] === "number" && Number.isFinite(row[key]))
  );
}
