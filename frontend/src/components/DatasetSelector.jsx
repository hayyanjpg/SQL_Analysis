import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Database,
  RefreshCw,
} from "lucide-react";

const rowCountFormatter = new Intl.NumberFormat("id-ID");

function formatRowCount(value) {
  return typeof value === "number" ? rowCountFormatter.format(value) : "—";
}

/**
 * DatasetSelector
 * Memilih tabel mana saja yang ikut dianalisis pada pertanyaan berikutnya.
 *
 * Aturan sederhana:
 * - pilihan kosong = semua tabel (default, backward-compatible);
 * - minimal satu tabel harus tetap dipilih;
 * - memilih semua tabel dikembalikan menjadi pilihan kosong agar ringkas.
 */
export default function DatasetSelector({
  tables = [],
  selected = [],
  onChange,
  loading = false,
  error = "",
  onRefresh,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const allNames = tables.map((item) => item.table);
  const effective = selected.length > 0 ? selected : allNames;
  const effectiveSet = new Set(effective);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function toggleTable(name) {
    const current = selected.length > 0 ? selected : allNames;
    const next = current.includes(name)
      ? current.filter((item) => item !== name)
      : [...current, name];

    // Analisis butuh minimal satu tabel; jangan biarkan kosong total.
    if (next.length === 0) return;

    onChange(next.length === allNames.length ? [] : next);
  }

  function selectAll() {
    onChange([]);
  }

  let summary = "Belum ada tabel";
  if (tables.length > 0) {
    if (selected.length === 0) {
      summary = `Semua tabel · ${tables.length}`;
    } else if (selected.length === 1) {
      summary = selected[0];
    } else {
      summary = `${selected.length} tabel dipilih`;
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 border-b border-ink/10 px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-haspopup="true"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <Database className="h-3.5 w-3.5 shrink-0 text-muted" />

          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
            Cakupan tabel
          </span>

          <span
            className={`truncate font-mono text-[9px] uppercase tracking-[0.12em] ${
              tables.length === 0 ? "text-muted/70" : "text-ink"
            }`}
            title={
              selected.length > 1 ? selected.join(", ") : undefined
            }
          >
            {summary}
          </span>

          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Muat ulang daftar tabel"
            title="Muat ulang daftar tabel"
            className="flex h-6 w-6 items-center justify-center text-muted transition-colors hover:text-ink disabled:opacity-40"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="absolute bottom-full left-0 right-0 z-20 mb-2 max-h-80 overflow-y-auto border border-ink bg-paper shadow-hard">
          <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-ink/15 bg-paper px-3 py-2">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink">
                Tabel yang dianalisis
              </p>
              <p className="mt-0.5 font-mono text-[9px] tabular-nums text-muted">
                {tables.length === 0
                  ? "belum ada tabel"
                  : `${effective.length} dari ${tables.length} dipilih`}
              </p>
            </div>

            {tables.length > 0 ? (
              <button
                type="button"
                onClick={selectAll}
                className="border border-ink/20 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted transition-colors hover:border-ink hover:bg-ink hover:text-paper"
              >
                Semua
              </button>
            ) : null}
          </div>

          {error ? (
            <div className="flex items-start gap-2 px-3 py-3">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              <div className="min-w-0">
                <p className="break-words text-xs leading-5 text-accent">
                  {error}
                </p>
                {onRefresh ? (
                  <button
                    type="button"
                    onClick={onRefresh}
                    className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink underline decoration-ink/30 underline-offset-2 hover:text-accent"
                  >
                    Coba lagi
                  </button>
                ) : null}
              </div>
            </div>
          ) : loading && tables.length === 0 ? (
            <p className="px-3 py-3 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
              Membaca daftar tabel…
            </p>
          ) : tables.length === 0 ? (
            <div className="px-3 py-4">
              <p className="text-xs font-medium leading-5 text-ink/80">
                Belum ada data untuk dipilih.
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Unggah file CSV, Excel, atau skrip SQL lebih dulu. Setelah
                tabelnya tersedia, Anda bisa memilih satu atau beberapa tabel
                untuk dianalisis dan diedit.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-ink/10">
              {tables.map((item) => {
                const checked = effectiveSet.has(item.table);
                const onlyOne =
                  effective.length === 1 && checked;

                return (
                  <li key={item.table}>
                    <button
                      type="button"
                      onClick={() => toggleTable(item.table)}
                      disabled={onlyOne}
                      aria-pressed={checked}
                      title={
                        onlyOne
                          ? "Minimal satu tabel harus dipilih"
                          : undefined
                      }
                      className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-ink/[0.04] disabled:cursor-not-allowed"
                    >
                      <span
                        className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center border ${
                          checked
                            ? "border-ink bg-ink text-paper"
                            : "border-ink/30 bg-paper text-transparent"
                        }`}
                        aria-hidden="true"
                      >
                        <Check className="h-2.5 w-2.5" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="break-all font-mono text-[10px] font-medium text-ink">
                            {item.table}
                          </span>
                          <span className="shrink-0 font-mono text-[9px] tabular-nums text-muted">
                            {item.row_count === null ||
                            item.row_count === undefined
                              ? "? baris"
                              : `${formatRowCount(item.row_count)} baris`}
                          </span>
                        </span>

                        <span className="mt-0.5 block break-words font-mono text-[9px] leading-4 text-muted">
                          {item.columns?.length
                            ? `${item.columns.length} kolom · ${item.columns
                                .slice(0, 6)
                                .map((column) => column.name)
                                .join(" · ")}${
                                item.columns.length > 6 ? " · …" : ""
                              }`
                            : "kolom tidak dilaporkan"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="border-t border-ink/15 px-3 py-2 font-mono text-[8px] uppercase leading-4 tracking-[0.12em] text-muted">
            Pilih lebih dari satu tabel untuk analisis gabungan. Tanpa pilihan
            berarti semua tabel.
          </p>
        </div>
      ) : null}
    </div>
  );
}
