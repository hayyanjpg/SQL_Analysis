import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildChartConfig, OTHERS_LABEL } from "../utils/chartConfig";
import { isMoneyColumn } from "../utils/columns";
import {
  formatChartTick,
  formatCompactByColumn,
  formatNumber,
  formatRupiah,
  prettyKey,
} from "../utils/format";

const MONO_FONT = "IBM Plex Mono, monospace";
const ACCENT = "#df4a26";
const INK = "#171614";
const MUTED = "#8d867a";

function ChartTooltip({ active, payload, label, valueKey, isMoney }) {
  if (!active || !payload?.length) return null;

  const value = payload[0].value;

  return (
    <div className="border border-ink bg-surface px-3 py-2 shadow-hard">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm font-medium tabular-nums text-ink">
        {isMoney ? formatRupiah(value) : formatNumber(value)}
      </p>
      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
        {prettyKey(valueKey)}
      </p>
    </div>
  );
}

export default function ResultChart({ columns = [], rows = [] }) {
  const config = buildChartConfig(columns, rows);
  if (!config) return null;

  const {
    data,
    labelKey,
    valueKey,
    mode,
    aggregation,
    totalCategories,
    shown,
    truncated,
    aggregated,
  } = config;

  const isMoney = isMoneyColumn(valueKey);
  const isLine = mode === "line";

  const xAxis = (
    <XAxis
      dataKey="label"
      tick={{
        fill: "#6f695c",
        fontSize: 9,
        fontFamily: MONO_FONT,
      }}
      tickLine={false}
      axisLine={{ stroke: INK, strokeOpacity: 0.2 }}
      tickFormatter={isLine ? formatChartTick : undefined}
      angle={isLine ? 0 : -22}
      textAnchor={isLine ? "middle" : "end"}
      height={isLine ? 34 : 64}
      interval={isLine ? "preserveStartEnd" : 0}
      minTickGap={isLine ? 24 : 10}
    />
  );

  const yAxis = (
    <YAxis
      tickFormatter={(value) => formatCompactByColumn(value, valueKey)}
      tick={{
        fill: "#6f695c",
        fontSize: 9,
        fontFamily: MONO_FONT,
      }}
      tickLine={false}
      axisLine={false}
      width={isMoney ? 74 : 58}
    />
  );

  const tooltip = (
    <Tooltip
      cursor={{ fill: "rgba(23,22,20,0.05)" }}
      content={<ChartTooltip valueKey={valueKey} isMoney={isMoney} />}
    />
  );

  const grid = (
    <CartesianGrid strokeDasharray="2 4" stroke="#d7d1c2" vertical={false} />
  );

  return (
    <section className="px-4 py-5 sm:px-5">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
            Grafik · {isLine ? "garis" : "batang"}
          </p>
          <h3 className="mt-1 text-sm font-bold tracking-[-0.01em]">
            {prettyKey(valueKey)}{" "}
            <span className="font-normal text-muted">menurut</span>{" "}
            {prettyKey(labelKey)}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {aggregated && aggregation === "avg" ? (
            <span className="border border-ink/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
              rata-rata
            </span>
          ) : null}

          <span
            className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${
              truncated
                ? "border-caution/40 text-caution"
                : "border-ink/15 text-muted"
            }`}
            title={
              truncated
                ? `Data dipotong: ${shown} dari ${totalCategories}. ${
                    isLine
                      ? "Hanya titik terbaru yang ditampilkan."
                      : `Sisanya digabung menjadi "${OTHERS_LABEL}".`
                  }`
                : undefined
            }
          >
            {truncated
              ? `${shown} dari ${totalCategories} ${isLine ? "titik" : "kategori"}`
              : `${totalCategories} ${isLine ? "titik" : "kategori"}`}
          </span>
        </div>
      </div>

      <div
        className="h-56 w-full sm:h-72"
        role="img"
        aria-label={`Grafik ${isLine ? "garis" : "batang"} ${prettyKey(
          valueKey
        )} menurut ${prettyKey(labelKey)}. Data lengkap tersedia pada tabel di bawah.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          {isLine ? (
            <LineChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              {grid}
              {xAxis}
              {yAxis}
              {tooltip}
              <Line
                type="monotone"
                dataKey="value"
                stroke={ACCENT}
                strokeWidth={2}
                dot={{ r: 3, fill: ACCENT, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: INK, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </LineChart>
          ) : (
            <BarChart
              data={data}
              margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
              barCategoryGap="28%"
            >
              {grid}
              {xAxis}
              {yAxis}
              {tooltip}
              <Bar
                dataKey="value"
                fill={ACCENT}
                maxBarSize={40}
                activeBar={{ fill: INK }}
                isAnimationActive={false}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.label}
                    fill={entry.label === OTHERS_LABEL ? MUTED : ACCENT}
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  );
}
