/**
 * HistoryDashboard.jsx
 * Dasbor riwayat pertanyaan yang disimpan di localStorage.
 *
 * Riwayat terpisah per akun (kunci penyimpanan memuat user id), sehingga akun
 * lain di browser yang sama tidak melihat pertanyaan akun sebelumnya. Tidak ada
 * data hasil query yang disimpan, hanya pertanyaan, SQL, dan metadata ringkas.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Search, Trash2, X } from "lucide-react";

const whenFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const countFormatter = new Intl.NumberFormat("id-ID");

function formatWhen(timestamp) {
  if (!timestamp) return "—";
  try {
    return whenFormatter.format(new Date(timestamp));
  } catch {
    return "—";
  }
}

function kindLabel(entry) {
  return entry.kind === "modify" ? "Ubah data" : "SELECT";
}

export default function HistoryDashboard({
  open,
  onClose,
  entries = [],
  onRerun,
  onDelete,
  onClear,
  tablesCount = 0,
  workspace = "",
}) {
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKey);
    const timer = window.setTimeout(() => searchRef.current?.focus(), 60);

    return () => {
      window.removeEventListener("keydown", handleKey);
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries;

    return entries.filter((entry) =>
      `${entry.question || ""} ${entry.sql || ""}`
        .toLowerCase()
        .includes(needle)
    );
  }, [entries, query]);

  if (!open) return null;

  const modifyCount = entries.filter((entry) => entry.kind === "modify").length;
  const selectCount = entries.length - modifyCount;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Dasbor riwayat"
    >
      <button
        type="button"
        aria-label="Tutup dasbor"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/30"
      />

      <aside className="relative flex h-full w-full max-w-md animate-fade-up flex-col border-l border-ink/20 bg-paper">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-ink/15 px-5 py-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
              Dasbor
            </p>
            <h2 className="mt-1 font-display text-2xl leading-none tracking-[-0.01em]">
              Riwayat pertanyaan
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dasbor"
            className="flex h-8 w-8 items-center justify-center border border-ink/20 text-muted transition-colors hover:border-ink hover:bg-ink hover:text-paper"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 border-b border-ink/15 px-5 py-4">
          <div className="grid grid-cols-3 border border-ink/15">
            {[
              ["Tersimpan", entries.length],
              ["SELECT", selectCount],
              ["Ubah", modifyCount],
            ].map(([label, value], index) => (
              <div
                key={label}
                className={`px-3 py-2.5 ${index > 0 ? "border-l border-ink/15" : ""}`}
              >
                <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-muted">
                  {label}
                </p>
                <p className="mt-0.5 font-mono text-lg tabular-nums leading-none">
                  {countFormatter.format(value)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 font-mono text-[8px] uppercase tracking-[0.14em] text-muted">
            <span>{tablesCount} tabel di ruang data</span>
            {workspace ? (
              <span className="truncate" title={workspace}>
                {workspace}
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex items-center gap-2 border border-ink/20 bg-surface px-2.5 py-1.5 focus-within:border-ink">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari pertanyaan atau SQL…"
              className="w-full bg-transparent text-xs text-ink placeholder:text-muted/60 focus:outline-none"
            />
          </div>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5">
          {filtered.length === 0 ? (
            <div className="py-10">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                {entries.length === 0 ? "Belum ada riwayat" : "Tidak ada hasil"}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted">
                {entries.length === 0
                  ? "Pertanyaan yang berhasil dijalankan akan tersimpan di browser ini, terpisah untuk setiap akun."
                  : "Coba kata kunci lain, atau hapus filter pencarian."}
              </p>
            </div>
          ) : (
            <ul>
              {filtered.map((entry) => (
                <li key={entry.id} className="group border-b border-ink/10">
                  <div className="flex items-start gap-2 py-3">
                    <button
                      type="button"
                      onClick={() => onRerun(entry)}
                      className="min-w-0 flex-1 text-left"
                      title="Jalankan lagi pertanyaan ini"
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[8px] uppercase tracking-[0.14em] text-muted">
                        <span>{formatWhen(entry.at)}</span>
                        <span
                          className={
                            entry.kind === "modify"
                              ? "border border-caution/40 bg-caution-soft px-1 py-0.5 text-caution"
                              : "border border-moss/30 bg-moss-soft px-1 py-0.5 text-moss"
                          }
                        >
                          {kindLabel(entry)}
                        </span>
                        {typeof entry.rowCount === "number" ? (
                          <span>{countFormatter.format(entry.rowCount)} baris</span>
                        ) : null}
                      </div>

                      <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-ink transition-colors group-hover:text-accent">
                        {entry.question}
                      </p>

                      {entry.sql ? (
                        <p className="mt-1 truncate font-mono text-[9px] leading-4 text-muted">
                          {entry.sql}
                        </p>
                      ) : null}
                    </button>

                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => onRerun(entry)}
                        aria-label="Jalankan lagi"
                        className="flex h-7 w-7 items-center justify-center border border-ink/15 text-muted transition-colors hover:border-ink hover:bg-ink hover:text-paper"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(entry.id)}
                        aria-label="Hapus dari riwayat"
                        className="flex h-7 w-7 items-center justify-center border border-ink/15 text-muted transition-colors hover:border-accent hover:bg-accent hover:text-paper"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="shrink-0 border-t border-ink/15 px-5 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-muted">
              Disimpan di browser ini
            </p>
            <button
              type="button"
              onClick={onClear}
              disabled={entries.length === 0}
              className="flex items-center gap-1.5 border border-ink/20 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-accent hover:bg-accent hover:text-paper disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Trash2 className="h-3 w-3" />
              Hapus semua
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
