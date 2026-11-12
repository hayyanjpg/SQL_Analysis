import { useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, ShieldCheck, X } from "lucide-react";
import {
  getAccessKey,
  saveAccessKey,
  verifyAccessKey,
} from "../api";
import { getErrorMessage } from "../utils/errors";

/**
 * Dialog untuk memasukkan kunci akses bersama.
 * Terbuka otomatis saat backend merespons 401, atau lewat tombol header.
 */
export default function AccessKeyModal({ open, onClose, onSaved }) {
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    setKey(getAccessKey());
    setError("");
    setSaving(false);

    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") onCloseRef.current?.();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError("");

    try {
      const value = await verifyAccessKey(key);
      saveAccessKey(value);
      onSaved?.(value);
      onClose?.();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  function handleClear() {
    if (saving) return;
    saveAccessKey("");
    onSaved?.("");
    onClose?.();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 px-3 py-4 backdrop-blur-[2px] sm:items-center sm:px-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-key-title"
        className="w-full max-w-md border border-ink bg-paper shadow-hard"
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink/15 px-4 py-3 sm:px-5">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
              Akses terbatas
            </p>
            <h2
              id="access-key-title"
              className="mt-1 font-display text-2xl leading-none tracking-[-0.01em]"
            >
              Kunci akses<span className="text-accent">.</span>
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Tutup dialog"
            className="-mr-1 -mt-1 p-1 text-muted transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-4 py-4 sm:px-5">
            <div className="flex items-start gap-3 border border-ink/15 bg-surface px-3 py-2.5">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-moss" />
              <p className="text-xs leading-5 text-ink/70">
                Aplikasi ini dilindungi kunci akses bersama. Masukkan kunci yang
                diberikan pemilik aplikasi. Kunci disimpan hanya di browser ini.
              </p>
            </div>

            <label
              htmlFor="access-key"
              className="mt-4 block font-mono text-[9px] uppercase tracking-[0.14em] text-muted"
            >
              Kunci akses
            </label>

            <div className="mt-1.5 flex items-center border border-ink/25 bg-paper focus-within:border-ink">
              <KeyRound className="ml-3 h-4 w-4 shrink-0 text-muted" />
              <input
                id="access-key"
                ref={inputRef}
                type="password"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="Masukkan kunci akses"
                autoComplete="current-password"
                disabled={saving}
                className="w-full resize-none bg-transparent px-2.5 py-2.5 font-mono text-sm text-ink placeholder:font-sans placeholder:text-muted/60 focus:outline-none disabled:opacity-60"
              />
            </div>

            {error ? (
              <p className="mt-2 break-words text-xs leading-5 text-accent">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-ink/15 px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={handleClear}
              disabled={saving}
              className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
            >
              Hapus kunci
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="border border-ink/20 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
              >
                Tutup
              </button>

              <button
                type="submit"
                disabled={!key.trim() || saving}
                aria-busy={saving}
                className="flex items-center gap-2 bg-ink px-3.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-35"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
                {saving ? "Memeriksa" : "Simpan kunci"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
