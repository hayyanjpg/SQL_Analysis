import { useState } from "react";
import axios from "axios";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { ENDPOINTS } from "../api";
import { getErrorMessage } from "../utils/errors";
import DataTable from "./DataTable";
import ResultChart from "./ResultChart";

function padRun(number) {
  return String(number ?? 0).padStart(2, "0");
}

function getCommand(sql = "") {
  const match = String(sql).match(/\b(INSERT|UPDATE|DELETE)\b/i);
  return match ? match[1].toUpperCase() : "DML";
}

const SUCCESS_HEADLINE = {
  INSERT: "Data berhasil ditambahkan.",
  UPDATE: "Data berhasil diperbarui.",
  DELETE: "Data berhasil dihapus.",
};

const STATUS_TONES = {
  moss: { text: "text-moss", dot: "bg-moss" },
  caution: { text: "text-caution", dot: "bg-caution" },
  danger: { text: "text-accent", dot: "bg-accent" },
  muted: { text: "text-muted", dot: "bg-muted" },
};

function CopyButton({ text, className = "" }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard tidak tersedia (mis. bukan secure context), abaikan saja.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`flex items-center gap-1.5 border border-paper/20 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-paper/60 transition-colors hover:border-paper/50 hover:text-paper ${className}`}
    >
      {copied ? (
        <Check className="h-3 w-3 text-[#8fbf9f]" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      {copied ? "Tersalin" : "Salin"}
    </button>
  );
}

function SqlDisclosure({ sql, label = "Lihat SQL" }) {
  if (!sql) return null;

  return (
    <details className="group border-t border-ink/15">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-mono text-[9px] uppercase tracking-[0.14em] text-muted transition-colors hover:bg-ink/[0.03] hover:text-ink [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <Code2 className="h-3.5 w-3.5" />
          {label}
        </span>
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
      </summary>

      <div className="relative border-t border-ink/10 bg-ink">
        <CopyButton text={sql} className="absolute right-3 top-3" />
        <pre className="scrollbar-thin overflow-x-auto p-4 pr-24 font-mono text-[11px] leading-6 text-[#e8e2d4]">
          <code>{sql}</code>
        </pre>
      </div>
    </details>
  );
}

export default function AssistantMessage({ message, tables = [] }) {
  const { data, error, runNo } = message;
  const [confirmState, setConfirmState] = useState("idle"); // idle | executing | success | cancelled | error
  const [execution, setExecution] = useState(null);
  const [confirmError, setConfirmError] = useState("");

  const isConfirmation = data?.status === "require_confirmation";
  const proposedSql = data?.query ?? "";
  const command = execution?.command ?? getCommand(proposedSql);

  const columns = data?.columns ?? [];
  const rows = data?.rows ?? [];

  let status = { label: "Selesai", tone: "moss", blink: false };

  if (error) {
    status = { label: "Gagal", tone: "danger", blink: false };
  } else if (isConfirmation) {
    if (confirmState === "executing") {
      status = { label: "Mengeksekusi", tone: "caution", blink: true };
    } else if (confirmState === "success") {
      status = { label: "Disetujui", tone: "moss", blink: false };
    } else if (confirmState === "cancelled") {
      status = { label: "Dibatalkan", tone: "muted", blink: false };
    } else if (confirmState === "error") {
      status = { label: "Gagal eksekusi", tone: "danger", blink: false };
    } else {
      status = { label: "Perlu izin", tone: "caution", blink: false };
    }
  }

  const statusTone = STATUS_TONES[status.tone];

  async function handleAllow() {
    if (confirmState === "executing" || !proposedSql) return;

    setConfirmState("executing");
    setConfirmError("");

    try {
      const { data: result } = await axios.post(
        ENDPOINTS.executeConfirmed,
        tables.length > 0 ? { query: proposedSql, tables } : { query: proposedSql },
        { timeout: 120000 }
      );
      setExecution(result);
      setConfirmState("success");
    } catch (requestError) {
      setConfirmError(getErrorMessage(requestError));
      setConfirmState("error");
    }
  }

  function handleCancel() {
    if (confirmState === "executing") return;
    setConfirmState("cancelled");
  }

  function renderConfirmation() {
    if (confirmState === "success") {
      const returningRows = execution?.rows ?? [];
      const returningColumns = execution?.columns ?? [];

      return (
        <div className="animate-fade-up mt-4 border border-ink/20 border-l-4 border-l-moss bg-moss-soft">
          <div className="flex items-start gap-3 px-4 py-3.5">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-moss" />

            <div className="min-w-0 flex-1">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-moss">
                Disetujui · {command}
              </p>
              <p className="mt-1 text-sm font-semibold leading-6 text-ink">
                {SUCCESS_HEADLINE[command] ?? "Data berhasil diperbarui."}
              </p>
              <p className="mt-1 break-words text-xs leading-5 text-ink/60">
                {execution?.message ?? "Perubahan data berhasil disimpan."}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em]">
                <span className="border border-ink/20 bg-paper/70 px-2 py-1 tabular-nums text-ink">
                  {execution?.rowcount ?? 0} baris terpengaruh
                </span>
                <span className="border border-moss/30 bg-paper/70 px-2 py-1 text-moss">
                  Tersimpan
                </span>
              </div>

              {returningRows.length > 0 ? (
                <div className="mt-3 border border-ink/15 bg-surface">
                  <div className="flex items-center justify-between gap-3 border-b border-ink/15 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                    <span className="text-ink">Baris yang dikembalikan</span>
                    <span>{returningRows.length} baris</span>
                  </div>
                  <DataTable
                    columns={returningColumns}
                    rows={returningRows}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <SqlDisclosure sql={proposedSql} label="Lihat query yang dieksekusi" />
        </div>
      );
    }

    if (confirmState === "cancelled") {
      return (
        <div className="animate-fade-up mt-4 border border-ink/20 border-l-4 border-l-muted bg-surface">
          <div className="flex items-start gap-3 px-4 py-3.5">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
                Dibatalkan
              </p>
              <p className="mt-1 text-sm font-semibold leading-6 text-ink/75">
                Eksekusi dibatalkan oleh pengguna.
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Tidak ada perubahan yang dikirim ke database.
              </p>
            </div>
          </div>

          <SqlDisclosure sql={proposedSql} label="Lihat query yang dibatalkan" />
        </div>
      );
    }

    const executing = confirmState === "executing";
    const failed = confirmState === "error";

    return (
      <div className="mt-4 border border-ink/20 border-l-4 border-l-caution bg-caution-soft">
        <div className="flex items-start gap-3 px-4 py-3.5">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-caution" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-caution">
                Perubahan data · {command}
              </p>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-caution/80">
                Belum dijalankan
              </span>
            </div>

            <p className="mt-1.5 text-sm font-semibold leading-6 text-ink">
              AI membutuhkan izin untuk memodifikasi data.
            </p>
            <p className="mt-1 text-xs leading-5 text-ink/60">
              Baca query di bawah. Perubahan baru disimpan setelah Anda
              menyetujui.
            </p>

            <div className="mt-3 border border-ink/20 bg-ink">
              <div className="flex items-center justify-between gap-3 border-b border-paper/10 px-3 py-1.5">
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-paper/45">
                  Query yang diusulkan
                </span>
                <CopyButton text={proposedSql} />
              </div>
              <pre className="scrollbar-thin overflow-x-auto p-3 font-mono text-[11px] leading-6 text-[#e8e2d4]">
                <code>{proposedSql}</code>
              </pre>
            </div>

            {failed && confirmError ? (
              <div className="mt-3 flex items-start gap-2 border border-accent/30 bg-paper/70 px-3 py-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                <p className="break-words text-xs leading-5 text-accent">
                  {confirmError}
                </p>
              </div>
            ) : null}

            {executing ? (
              <div className="mt-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-caution">
                <Loader2 className="h-3 w-3 animate-spin" />
                Mengirim perubahan ke database…
              </div>
            ) : null}

            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAllow}
                disabled={executing}
                aria-busy={executing}
                className="flex items-center gap-2 bg-moss px-3.5 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-45"
              >
                {executing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
                {executing
                  ? "Mengeksekusi"
                  : failed
                    ? "Coba Lagi"
                    : "Izinkan Eksekusi"}
              </button>

              <button
                type="button"
                onClick={handleCancel}
                disabled={executing}
                className="flex items-center gap-2 border border-ink/25 px-3.5 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
              >
                <X className="h-3.5 w-3.5" />
                Batalkan
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <article className="animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink pb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em]">
          Sift / Run {padRun(runNo)}
        </span>

        <span
          className={`flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] ${statusTone.text}`}
        >
          <span
            className={`h-1 w-1 ${statusTone.dot} ${
              status.blink ? "animate-blink" : ""
            }`}
          />
          {status.label}
        </span>
      </div>

      {error ? (
        <div className="mt-4 border border-ink/20 border-l-4 border-l-accent bg-accent-soft px-4 py-3.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-accent">
            Permintaan gagal
          </p>
          <p className="mt-2 break-words text-sm leading-6 text-ink/85">
            {error}
          </p>
          <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-ink/45">
            {tables.length > 0
              ? `Cakupan: ${tables.join(", ")}`
              : "Cakupan: semua tabel"}
          </p>
        </div>
      ) : isConfirmation ? (
        renderConfirmation()
      ) : (
        <div className="mt-4 border border-ink/20 bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 px-4 py-2.5">
            <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
              <span className="text-ink">
                {data?.row_count ?? rows.length} baris
              </span>
              <span className="text-rule">/</span>
              <span>{columns.length} kolom</span>
            </div>
            <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-moss">
              <span className="h-1 w-1 bg-moss" />
              Read-only
            </span>
          </div>

          {/* Grafik hanya muncul jika data punya label + nilai angka */}
          <ResultChart columns={columns} rows={rows} />

          <DataTable columns={columns} rows={rows} />

          <SqlDisclosure sql={data?.sql} />
        </div>
      )}
    </article>
  );
}
