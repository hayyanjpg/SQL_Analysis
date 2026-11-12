/**
 * chartConfig.js
 * Logika murni untuk memilih sumbu dan menyiapkan data grafik.
 * Tanpa JSX supaya mudah diuji terpisah dari komponen.
 */

import {
  aggregationFor,
  isChartNumeric,
  isIdLike,
  isMoneyColumn,
  isTemporalColumn,
} from "./columns";

/** Maksimal batang sebelum sisanya digabung menjadi "Lainnya". */
export const MAX_CATEGORIES = 12;
/** Jumlah batang teratas yang dipertahankan saat data dipotong. */
export const TOP_CATEGORIES = 10;
/** Maksimal titik pada grafik garis (data waktu). */
export const MAX_POINTS = 60;

export const OTHERS_LABEL = "Lainnya";

function uniqueCount(rows, key) {
  const seen = new Set();
  for (const row of rows) {
    const value = row?.[key];
    if (value === null || value === undefined || value === "") continue;
    seen.add(String(value));
  }
  return seen.size;
}

/**
 * Susun konfigurasi grafik dari hasil query.
 * Mengembalikan null jika data tidak layak digambarkan.
 */
export function buildChartConfig(columns, rows) {
  if (!Array.isArray(columns) || columns.length === 0) return null;
  if (!Array.isArray(rows) || rows.length < 2) return null;

  const temporalKeys = columns.filter((key) => isTemporalColumn(key, rows));

  // Kolom nilai: angka, bukan id, bukan kolom waktu (tahun 2026 bukan nilai).
  const numericKeys = columns.filter(
    (key) =>
      !temporalKeys.includes(key) && !isIdLike(key) && isChartNumeric(rows, key)
  );
  if (numericKeys.length === 0) return null;

  // Prioritaskan kolom uang sebagai nilai utama.
  const valueKey = numericKeys.find(isMoneyColumn) ?? numericKeys[0];
  const aggregation = aggregationFor(valueKey);

  let labelKey = null;
  let mode = "bar";

  // Tren waktu lebih berguna sebagai garis.
  const temporalLabel = temporalKeys
    .map((key) => ({ key, count: uniqueCount(rows, key) }))
    .filter((candidate) => candidate.count >= 2)
    .sort((a, b) => b.count - a.count)[0];

  if (temporalLabel) {
    labelKey = temporalLabel.key;
    mode = "line";
  } else {
    // Untuk kategori, pilih kolom dengan nilai unik paling sedikit.
    // Kolom seperti nama/email (hampir unik) jadi pilihan terakhir.
    const candidates = columns
      .filter(
        (key) =>
          !numericKeys.includes(key) &&
          !temporalKeys.includes(key) &&
          !isIdLike(key)
      )
      .map((key, index) => ({ key, index, count: uniqueCount(rows, key) }))
      .filter((candidate) => candidate.count >= 2)
      .sort((a, b) => a.count - b.count || a.index - b.index);

    labelKey = candidates[0]?.key ?? null;
  }

  if (!labelKey) return null;

  const grouped = new Map();
  let usableRows = 0;

  for (const row of rows) {
    const rawLabel = row?.[labelKey];
    if (rawLabel === null || rawLabel === undefined || rawLabel === "") continue;

    const rawValue = row?.[valueKey];
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) continue;

    usableRows += 1;
    const label = String(rawLabel);
    const bucket = grouped.get(label) ?? { sum: 0, count: 0 };
    bucket.sum += rawValue;
    bucket.count += 1;
    grouped.set(label, bucket);
  }

  if (grouped.size < 2) return null;

  const totalCategories = grouped.size;
  let entries = [...grouped.entries()].map(([label, bucket]) => ({
    label,
    value: aggregation === "avg" ? bucket.sum / bucket.count : bucket.sum,
    count: bucket.count,
  }));

  let truncated = false;

  if (mode === "line") {
    entries.sort((a, b) =>
      a.label.localeCompare(b.label, "id", { numeric: true })
    );
    if (entries.length > MAX_POINTS) {
      entries = entries.slice(-MAX_POINTS);
      truncated = true;
    }
  } else {
    entries.sort((a, b) => b.value - a.value);

    if (entries.length > MAX_CATEGORIES) {
      const head = entries.slice(0, TOP_CATEGORIES);
      const rest = entries.slice(TOP_CATEGORIES);

      const restCount = rest.reduce((total, entry) => total + entry.count, 0);
      const restValue =
        aggregation === "avg"
          ? rest.reduce((total, entry) => total + entry.value * entry.count, 0) /
            (restCount || 1)
          : rest.reduce((total, entry) => total + entry.value, 0);

      head.push({ label: OTHERS_LABEL, value: restValue, count: restCount });
      entries = head;
      truncated = true;
    }
  }

  return {
    labelKey,
    valueKey,
    mode,
    aggregation,
    data: entries.map(({ label, value }) => ({ label, value })),
    totalCategories,
    shown: entries.length,
    truncated,
    aggregated: totalCategories < usableRows,
  };
}
