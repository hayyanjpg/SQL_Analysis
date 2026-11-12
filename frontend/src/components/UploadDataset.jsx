import { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  AlertTriangle,
  Database,
  FileSpreadsheet,
  FileText,
  FileUp,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { ALLOWED_EXTENSIONS, ENDPOINTS, FILE_LIMITS_MB } from "../api";
import { getErrorMessage } from "../utils/errors";

const IF_EXISTS_OPTIONS = [
  {
    value: "fail",
    label: "Tolak",
    hint: "Upload dibatalkan bila nama tabel sudah dipakai.",
  },
  {
    value: "replace",
    label: "Ganti",
    hint: "Tabel lama dihapus, lalu dibuat ulang dari file ini.",
  },
  {
    value: "append",
    label: "Tambah",
    hint: "Baris dari file ditambahkan ke tabel yang sudah ada.",
  },
];

function extensionOf(filename = "") {
  const index = filename.lastIndexOf(".");
  return index === -1 ? "" : filename.slice(index).toLowerCase();
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file) {
  if (!file) return "Pilih file terlebih dahulu.";

  const extension = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return `Format '${extension || "(tanpa ekstensi)"}' tidak didukung. Gunakan CSV, XLSX, XLS, atau SQL.`;
  }

  if (file.size === 0) return "File kosong (0 byte).";

  const limit = FILE_LIMITS_MB[extension];
  if (file.size > limit * 1024 * 1024) {
    return `Ukuran file ${formatBytes(file.size)} melebihi batas ${limit} MB untuk ${extension}.`;
  }

  return "";
}

/**
 * Tombol header + modal dropzone untuk upload CSV/XLSX/XLS/SQL.
 * Sukses/gagal dilaporkan ke App lewat callback agar tampil sebagai toast.
 */
export default function UploadDataset({ onSuccess, onError }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("fail");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | uploading | processing
  const [progress, setProgress] = useState(0);
  const [localError, setLocalError] = useState("");

  const inputRef = useRef(null);
  const dropzoneRef = useRef(null);

  const extension = file ? extensionOf(file.name) : "";
  const isSql = extension === ".sql";
  const selectedMode =
    IF_EXISTS_OPTIONS.find((option) => option.value === mode) ??
    IF_EXISTS_OPTIONS[0];

  function resetForm() {
    setFile(null);
    setMode("fail");
    setDragging(false);
    setLocalError("");
    setProgress(0);
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  function openModal() {
    resetForm();
    setOpen(true);
  }

  function closeModal() {
    if (uploading) return;
    setOpen(false);
    resetForm();
  }

  // Kunci scroll + tutup dengan Escape selama modal terbuka.
  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape" && !uploading) {
        setOpen(false);
        resetForm();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, uploading]);

  useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => dropzoneRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  function acceptFile(candidate) {
    if (!candidate || uploading) return;

    const message = validateFile(candidate);
    if (message) {
      setFile(null);
      setLocalError(message);
      return;
    }

    setLocalError("");
    setFile(candidate);
  }

  function handleInputChange(event) {
    acceptFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer?.files?.[0]);
  }

  async function handleSubmit(event) {
    event?.preventDefault?.();
    if (uploading) return;

    const message = validateFile(file);
    if (message) {
      setLocalError(message);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    setPhase("uploading");
    setProgress(0);
    setLocalError("");

    try {
      const { data } = await axios.post(ENDPOINTS.upload, formData, {
        timeout: 180000,
        params: isSql ? undefined : { if_exists: mode },
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return;
          const percent = Math.min(
            100,
            Math.round((progressEvent.loaded / progressEvent.total) * 100)
          );
          setProgress(percent);
          if (percent >= 100) setPhase("processing");
        },
      });

      onSuccess?.(data);
      setOpen(false);
      resetForm();
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setLocalError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setUploading(false);
      setPhase("idle");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        aria-label="Unggah dataset"
        aria-haspopup="dialog"
        className="flex items-center gap-2 border border-ink/20 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-ink hover:bg-ink hover:text-paper"
      >
        <FileUp className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Unggah data</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 px-3 py-4 backdrop-blur-[2px] sm:items-center sm:px-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-title"
            className="scrollbar-thin max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto border border-ink bg-paper shadow-hard"
          >
            <div className="flex items-start justify-between gap-4 border-b border-ink/15 px-4 py-3 sm:px-5">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
                  Bring your own data
                </p>
                <h2
                  id="upload-title"
                  className="mt-1 font-display text-2xl leading-none tracking-[-0.01em]"
                >
                  Unggah dataset<span className="text-accent">.</span>
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={uploading}
                aria-label="Tutup dialog"
                className="-mr-1 -mt-1 p-1 text-muted transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4 py-4 sm:px-5">
              <button
                ref={dropzoneRef}
                type="button"
                onClick={() => {
                  if (!uploading) inputRef.current?.click();
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!uploading) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`flex w-full flex-col items-center justify-center gap-1.5 border border-dashed px-4 py-7 text-center transition-colors ${
                  dragging
                    ? "border-accent bg-accent-soft"
                    : "border-ink/30 bg-surface hover:border-ink hover:bg-paper"
                }`}
              >
                <Upload
                  className={`h-6 w-6 ${dragging ? "text-accent" : "text-muted"}`}
                />
                <span className="text-sm font-semibold">
                  {file ? "Ganti file" : "Letakkan file di sini"}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                  atau klik untuk memilih
                </span>
              </button>

              <input
                ref={inputRef}
                type="file"
                accept={ALLOWED_EXTENSIONS.join(",")}
                onChange={handleInputChange}
                className="sr-only"
                tabIndex={-1}
              />

              {file ? (
                <div className="mt-3 flex items-center gap-3 border border-ink/15 bg-paper px-3 py-2.5">
                  {isSql ? (
                    <FileText className="h-5 w-5 shrink-0 text-ink/70" />
                  ) : (
                    <FileSpreadsheet className="h-5 w-5 shrink-0 text-ink/70" />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[11px] text-ink">
                      {file.name}
                    </p>
                    <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                      {extension.replace(".", "")} · {formatBytes(file.size)}
                      {isSql ? " · skrip sql" : ""}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setLocalError("");
                    }}
                    disabled={uploading}
                    aria-label="Hapus file"
                    className="shrink-0 p-1 text-muted transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}

              {file && !isSql ? (
                <div className="mt-3">
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                    Jika tabel sudah ada
                  </p>

                  <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                    {IF_EXISTS_OPTIONS.map((option) => {
                      const active = option.value === mode;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setMode(option.value)}
                          disabled={uploading}
                          aria-pressed={active}
                          className={`border px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                            active
                              ? "border-ink bg-ink text-paper"
                              : "border-ink/20 text-muted hover:border-ink hover:text-ink"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-1.5 text-[11px] leading-5 text-muted">
                    {selectedMode.hint}
                  </p>
                </div>
              ) : null}

              {isSql ? (
                <p className="mt-3 border border-ink/15 bg-surface px-3 py-2 text-[11px] leading-5 text-muted">
                  Skrip dijalankan atomik dalam satu transaksi.{" "}
                  <span className="text-ink">DROP DATABASE</span>, manajemen
                  role/user, dan perintah admin lain diblokir backend.
                </p>
              ) : null}

              {localError ? (
                <div className="mt-3 border border-ink/20 border-l-4 border-l-accent bg-accent-soft px-3 py-2.5">
                  <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-accent">
                    <AlertTriangle className="h-3 w-3" />
                    Upload gagal
                  </p>
                  <p className="mt-1.5 break-words text-xs leading-5 text-ink/80">
                    {localError}
                  </p>
                </div>
              ) : null}

              {uploading ? (
                <div className="mt-3 border border-ink/15 bg-surface px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-[0.14em]">
                    <span className="flex items-center gap-2 text-ink">
                      <Loader2 className="h-3 w-3 animate-spin text-accent" />
                      {phase === "processing"
                        ? "Memproses di server"
                        : "Mengunggah file"}
                    </span>
                    <span className="tabular-nums text-muted">
                      {phase === "processing" ? "…" : `${progress}%`}
                    </span>
                  </div>

                  <div className="mt-2 h-px w-full overflow-hidden bg-rule">
                    {phase === "processing" ? (
                      <div className="h-px w-1/3 animate-progress bg-accent" />
                    ) : (
                      <div
                        className="h-px bg-accent transition-[width] duration-200"
                        style={{ width: `${progress}%` }}
                      />
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-ink/15 px-4 py-3 sm:px-5">
              <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                <Database className="h-3 w-3" />
                CSV · XLSX · XLS · SQL
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={uploading}
                  className="border border-ink/20 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Tutup
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!file || uploading}
                  aria-busy={uploading}
                  className="flex items-center gap-2 bg-ink px-3.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {uploading ? "Mengunggah" : "Unggah file"}
                </button>
              </div>
            </div>

            <p className="border-t border-ink/10 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted sm:px-5">
              Batas: CSV/XLSX/XLS {FILE_LIMITS_MB[".csv"]} MB · SQL{" "}
              {FILE_LIMITS_MB[".sql"]} MB
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
