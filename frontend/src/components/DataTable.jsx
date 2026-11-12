import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { isNumericColumn } from "../utils/columns";
import { formatCell, prettyKey } from "../utils/format";

function SortIcon({ active, direction }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 opacity-35" />;
  return direction === "asc" ? (
    <ArrowUp className="h-3 w-3" />
  ) : (
    <ArrowDown className="h-3 w-3" />
  );
}

export default function DataTable({ columns = [], rows = [] }) {
  const [sort, setSort] = useState({ key: null, direction: "asc" });

  const resolvedColumns =
    columns.length > 0
      ? columns
      : rows.length > 0
        ? Object.keys(rows[0])
        : [];

  const numericColumns = useMemo(
    () =>
      Object.fromEntries(
        resolvedColumns.map((column) => [
          column,
          isNumericColumn(rows, column),
        ])
      ),
    [resolvedColumns, rows]
  );

  const sortedRows = useMemo(() => {
    if (!sort.key) return rows;

    const factor = sort.direction === "asc" ? 1 : -1;
    const key = sort.key;

    return [...rows].sort((a, b) => {
      const left = a?.[key];
      const right = b?.[key];

      const leftEmpty = left === null || left === undefined || left === "";
      const rightEmpty = right === null || right === undefined || right === "";

      if (leftEmpty && rightEmpty) return 0;
      if (leftEmpty) return 1;
      if (rightEmpty) return -1;

      if (typeof left === "number" && typeof right === "number") {
        return (left - right) * factor;
      }

      return (
        String(left).localeCompare(String(right), "id", { numeric: true }) *
        factor
      );
    });
  }, [rows, sort]);

  function toggleSort(column) {
    setSort((previous) =>
      previous.key === column
        ? {
            key: column,
            direction: previous.direction === "asc" ? "desc" : "asc",
          }
        : { key: column, direction: "asc" }
    );
  }

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
              {resolvedColumns.map((column) => {
                const active = sort.key === column;
                return (
                  <th
                    key={column}
                    scope="col"
                    title={`Urutkan menurut ${column}`}
                    aria-sort={
                      active
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className={`whitespace-nowrap border-b border-paper/10 font-mono text-[9px] font-normal uppercase tracking-[0.14em] ${
                      numericColumns[column] ? "text-right" : "text-left"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(column)}
                      className={`flex w-full items-center gap-1 px-4 py-2.5 text-inherit transition-colors hover:text-paper ${
                        numericColumns[column] ? "justify-end" : "justify-start"
                      }`}
                    >
                      <span className="truncate">{prettyKey(column)}</span>
                      <SortIcon
                        active={active}
                        direction={sort.direction}
                      />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {sortedRows.map((row, rowIndex) => (
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
                    {formatCell(row[column], column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-ink/10 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted sm:px-4">
        <span>{rows.length} baris</span>
        <span className="hidden sm:inline">
          {sort.key
            ? `Diurutkan: ${prettyKey(sort.key)} ${sort.direction === "asc" ? "↑" : "↓"}`
            : "Klik judul kolom untuk mengurutkan"}
        </span>
      </div>
    </div>
  );
}
