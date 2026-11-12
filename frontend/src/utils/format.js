/**
 * format.js
 * Format angka, uang, dan tanggal untuk tampilan Indonesia.
 */

import { isMoneyColumn } from "./columns";

const numberFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const monthFormatter = new Intl.DateTimeFormat("id-ID", {
  month: "short",
  year: "numeric",
});

const dayMonthFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
});

const ISO_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;
const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;

/** Format angka dengan pemisah ribuan Indonesia (53.193.000). */
export function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (typeof value === "number") return numberFormatter.format(value);
  return String(value);
}

/** Format uang rupiah tanpa desimal (Rp17.998.000). */
export function formatRupiah(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (typeof value !== "number") return String(value);
  // Intl menyisipkan spasi non-breaking setelah "Rp"; rapatkan agar konsisten.
  return currencyFormatter.format(value).replace(/\u00a0/g, "");
}

/** Format angka ringkas untuk sumbu grafik (53,2 jt). */
export function formatCompact(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return compactFormatter.format(value);
}

/** Format ringkas untuk sumbu Y; kolom uang diberi awalan Rp. */
export function formatCompactByColumn(value, column) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  const compact = compactFormatter.format(value);
  return isMoneyColumn(column) ? `Rp${compact}` : compact;
}

/**
 * Ubah ISO date/datetime menjadi teks Indonesia.
 * Mengembalikan null jika bukan tanggal, agar pemanggil bisa memakai nilai asli.
 */
export function formatDateValue(value) {
  if (typeof value !== "string") return null;

  const dateTime = value.match(ISO_DATETIME);
  if (dateTime) {
    const date = new Date(
      Number(dateTime[1]),
      Number(dateTime[2]) - 1,
      Number(dateTime[3]),
      Number(dateTime[4]),
      Number(dateTime[5]),
      dateTime[6] ? Number(dateTime[6]) : 0
    );
    return dateTimeFormatter.format(date);
  }

  const dateOnly = value.match(ISO_DATE_ONLY);
  if (dateOnly) {
    return dateFormatter.format(
      new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    );
  }

  return null;
}

/** Label ringkas untuk sumbu X grafik (Jan 2026, 8 Jan, atau teks asli). */
export function formatChartTick(label) {
  const text = String(label ?? "");

  const month = text.match(ISO_MONTH);
  if (month) {
    return monthFormatter.format(
      new Date(Number(month[1]), Number(month[2]) - 1, 1)
    );
  }

  const day = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ]|$)/);
  if (day) {
    return dayMonthFormatter.format(
      new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]))
    );
  }

  return text;
}

/** Format nilai sel tabel secara aman (null, boolean, objek, angka, tanggal). */
export function formatCell(value, column) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    return isMoneyColumn(column)
      ? formatRupiah(value)
      : numberFormatter.format(value);
  }
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "string") return formatDateValue(value) ?? value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Ubah snake_case menjadi label yang enak dibaca. */
export function prettyKey(key) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
