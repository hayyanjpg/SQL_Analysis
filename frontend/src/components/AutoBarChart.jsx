import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, formatNumber, prettyKey } from "../utils/format";

const MONO_FONT = "IBM Plex Mono, monospace";
const MONEY_HINTS =
  /(amount|revenue|price|harga|total|penjualan|pembelian|pendapatan|omzet)/i;
const NON_MONEY_HINTS = /(qty|quantity|count|jumlah|(^|_)id($|_))/i;

/**
 * Deteksi otomatis apakah hasil query cocok dibuat bar chart.
 * Syarat: minimal 2 baris, ada kolom teks (label) dan kolom angka (nilai).
 * Label duplikat dijumlahkan agar grafik tetap rapi.
 */
export function buildChartConfig(columns, rows) {
  if (!Array.isArray(columns) || !Array.isArray(rows) || rows.length < 2) {
    return null;
  }

  const numericKeys = columns.filter((key) =>
    rows.every(
      (row) => typeof row[key] === "number" && Number.isFinite(row[key])
    )
  );
  if (numericKeys.length === 0) return null;

  const labelCandidates = columns.filter((key) => {
    if (numericKeys.includes(key)) return false;
    return rows.every(
      (row) => row[key] === null || typeof row[key] === "string"
    );
  });
  if (labelCandidates.length === 0) return null;

  // Pilih kolom label dengan variasi nilai paling banyak.
  labelCandidates.sort((a, b) => {
    const uniqueA = new Set(rows.map((row) => row[a])).size;
    const uniqueB = new Set(rows.map((row) => row[b])).size;
    return uniqueB - uniqueA;
  });
  const labelKey = labelCandidates[0];

  // Prioritaskan kolom uang/pendapatan, hindari kolom id/quantity.
  const valueKey =
    numericKeys.find(
      (key) => MONEY_HINTS.test(key) && !NON_MONEY_HINTS.test(key)
    ) || numericKeys[0];

  const grouped = new Map();
  for (const row of rows) {
    const label = row[labelKey] ?? "Tidak diketahui";
    const value = Number(row[valueKey]) || 0;
    grouped.set(label, (grouped.get(label) ?? 0) + value);
  }

  const data = [...grouped.entries()]
    .slice(0, 12)
    .map(([label, value]) => ({ label, value }));

  if (data.length < 2) return null;

  return { labelKey, valueKey, data };
}

function ChartTooltip({ active, payload, label, valueKey }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="border border-ink bg-surface px-3 py-2 shadow-hard">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm font-medium tabular-nums text-ink">
        {formatNumber(payload[0].value)}
      </p>
      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
        {prettyKey(valueKey)}
      </p>
    </div>
  );
}

export default function AutoBarChart({ columns = [], rows = [] }) {
  const config = buildChartConfig(columns, rows);
  if (!config) return null;

  const { data, labelKey, valueKey } = config;

  return (
    <section className="px-4 py-5 sm:px-5">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
            Grafik
          </p>
          <h3 className="mt-1 text-sm font-bold tracking-[-0.01em]">
            {prettyKey(valueKey)}{" "}
            <span className="font-normal text-muted">menurut</span>{" "}
            {prettyKey(labelKey)}
          </h3>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
          {data.length} data
        </span>
      </div>

      <div className="h-56 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
            barCategoryGap="28%"
          >
            <CartesianGrid
              strokeDasharray="2 4"
              stroke="#d7d1c2"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{
                fill: "#6f695c",
                fontSize: 9,
                fontFamily: MONO_FONT,
              }}
              tickLine={false}
              axisLine={{ stroke: "#171614", strokeOpacity: 0.2 }}
              angle={-22}
              textAnchor="end"
              height={64}
              interval="preserveStartEnd"
              minTickGap={10}
            />
            <YAxis
              tickFormatter={formatCompact}
              tick={{
                fill: "#6f695c",
                fontSize: 9,
                fontFamily: MONO_FONT,
              }}
              tickLine={false}
              axisLine={false}
              width={58}
            />
            <Tooltip
              cursor={{ fill: "rgba(23,22,20,0.05)" }}
              content={<ChartTooltip valueKey={valueKey} />}
            />
            <Bar
              dataKey="value"
              fill="#df4a26"
              maxBarSize={40}
              activeBar={{ fill: "#171614" }}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
