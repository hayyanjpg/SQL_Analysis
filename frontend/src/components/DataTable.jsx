import { formatCell, isNumericColumn, prettyKey } from "../utils/format";

export default function DataTable({ columns = [], rows = [] }) {
  const resolvedColumns =
    columns.length > 0
      ? columns
      : rows.length > 0
        ? Object.keys(rows[0])
        : [];

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 border-t border-ink/15 px-6 py-10 text-center">
        <p className="font-display text-2xl italic text-ink/35">Kosong.</p>
        <p className="text-xs leading-5 text-muted">
          Query berhasil dijalankan, tetapi tidak ada baris yang cocok.
        </p>
      </div>
    );
  }

  const numericColumns = Object.fromEntries(
    resolvedColumns.map((column) => [column, isNumericColumn(rows, column)])
  );

  return (
    <div className="border-t border-ink/15">
      <div className="scrollbar-thin max-h-[420px] overflow-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-ink text-paper">
            <tr>
              <th
                scope="col"
                className="w-10 whitespace-nowrap border-b border-paper/10 px-3 py-2.5 text-left font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-paper/40"
              >
                #
              </th>
              {resolvedColumns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  title={column}
                  className={`whitespace-nowrap border-b border-paper/10 px-4 py-2.5 font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-paper/55 ${
                    numericColumns[column] ? "text-right" : "text-left"
                  }`}
                >
                  {prettyKey(column)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-ink/10 transition-colors last:border-b-0 hover:bg-ink/[0.035]"
              >
                <td className="px-3 py-2.5 font-mono text-[9px] tabular-nums text-muted/60">
                  {String(rowIndex + 1).padStart(2, "0")}
                </td>

                {resolvedColumns.map((column) => (
                  <td
                    key={column}
                    className={`whitespace-nowrap px-4 py-2.5 ${
                      numericColumns[column]
                        ? "text-right font-mono text-xs tabular-nums text-ink"
                        : "text-[13px] text-ink/80"
                    }`}
                  >
                    {formatCell(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-ink/10 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted sm:px-4">
        <span>{rows.length} baris</span>
        <span className="hidden sm:inline">Data langsung dari PostgreSQL</span>
      </div>
    </div>
  );
}
