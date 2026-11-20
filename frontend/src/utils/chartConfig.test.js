import assert from "node:assert/strict";
import test from "node:test";

import { buildChartConfig, OTHERS_LABEL } from "./chartConfig.js";

test("mengembalikan null bila baris kurang dari dua", () => {
  const config = buildChartConfig(
    ["category", "total_penjualan"],
    [{ category: "A", total_penjualan: 10 }]
  );

  assert.equal(config, null);
});

test("membuat grafik batang dari kategori dan nilai uang", () => {
  const config = buildChartConfig(
    ["category", "total_penjualan"],
    [
      { category: "A", total_penjualan: 10 },
      { category: "B", total_penjualan: 20 },
    ]
  );

  assert.ok(config);
  assert.equal(config.mode, "bar");
  assert.equal(config.labelKey, "category");
  assert.equal(config.valueKey, "total_penjualan");
  assert.equal(config.aggregation, "sum");
  assert.deepEqual(config.data, [
    { label: "B", value: 20 },
    { label: "A", value: 10 },
  ]);
});

test("menggabungkan kategori di luar 10 teratas menjadi Lainnya", () => {
  const rows = Array.from({ length: 13 }, (_, index) => ({
    category: `Kategori ${index + 1}`,
    total_penjualan: 13 - index,
  }));

  const config = buildChartConfig(["category", "total_penjualan"], rows);

  assert.ok(config);
  assert.equal(config.totalCategories, 13);
  assert.equal(config.data.length, 11);
  assert.equal(config.truncated, true);
  assert.equal(config.data.at(-1).label, OTHERS_LABEL);
  assert.equal(config.data.at(-1).value, 6);
});

test("memakai grafik garis dan urutan tanggal untuk data waktu", () => {
  const config = buildChartConfig(
    ["sale_date", "total_penjualan"],
    [
      { sale_date: "2026-02-01", total_penjualan: 20 },
      { sale_date: "2026-01-01", total_penjualan: 10 },
    ]
  );

  assert.ok(config);
  assert.equal(config.mode, "line");
  assert.equal(config.labelKey, "sale_date");
  assert.deepEqual(config.data, [
    { label: "2026-01-01", value: 10 },
    { label: "2026-02-01", value: 20 },
  ]);
});
