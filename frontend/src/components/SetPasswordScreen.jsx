/**
 * SetPasswordScreen.jsx
 * Muncul setelah pengguna membuka tautan "lupa kata sandi" dari Supabase.
 *
 * Tautan pemulihan membuat sesi sementara; layar ini memakai sesi itu untuk
 * menyetel kata sandi baru lewat supabase.auth.updateUser. Setelah berhasil,
 * pengguna langsung masuk ke ruang datanya.
 */

import { useState } from "react";
import { ArrowRight, KeyRound, Loader2, LogOut } from "lucide-react";
import { supabase } from "../supabase";

function friendlyError(message) {
  const text = (message || "").toLowerCase();
  if (text.includes("password should be")) {
    return "Kata sandi terlalu lemah (minimal 6 karakter).";
  }
  if (text.includes("same password")) {
    return "Kata sandi baru harus berbeda dari kata sandi lama.";
  }
  if (text.includes("session") || text.includes("jwt")) {
    return "Tautan atur ulang sudah kedaluwarsa. Minta tautan baru dari halaman masuk.";
  }
  return message || "Gagal menyimpan kata sandi. Coba lagi.";
}

export default function SetPasswordScreen({ onDone, onCancel }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (password.length < 6) {
      setError("Kata sandi minimal 6 karakter.");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi kata sandi tidak sama.");
      return;
    }

    setBusy(true);
    setError("");

    const { error: authError } = await supabase.auth.updateUser({ password });

    setBusy(false);

    if (authError) {
      setError(friendlyError(authError.message));
      return;
    }

    onDone?.();
  }

  async function handleCancel() {
    setBusy(true);
    try {
      await supabase.auth.signOut();
    } catch {
      // Sesi mungkin sudah tidak valid; tetap kembali ke halaman masuk.
    } finally {
      setBusy(false);
      onCancel?.();
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-paper px-4 py-10 text-ink">
      <div className="grain" aria-hidden="true" />

      <div className="w-full max-w-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-ink text-paper">
            <span className="font-display text-2xl leading-none">S</span>
          </div>
          <div className="leading-tight">
            <p className="text-base font-extrabold tracking-[-0.02em]">
              SIFT<span className="text-accent">.</span>
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted">
              Text → SQL desk
            </p>
          </div>
        </div>

        <h1 className="mt-10 font-display text-4xl leading-[0.95] tracking-[-0.02em]">
          Atur
          <br />
          <span className="italic text-accent">kata sandi baru.</span>
        </h1>

        <p className="mt-4 text-sm leading-6 text-muted">
          Ini kata sandi untuk akun aplikasi Anda, bukan kata sandi Gmail.
          Setelah disimpan, gunakan kata sandi ini di tab{" "}
          <span className="text-ink">Kata sandi</span>.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 border border-ink/15 bg-surface p-5">
          <label
            htmlFor="new-password"
            className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted"
          >
            Kata sandi baru
          </label>
          <div className="mt-1.5 flex items-center gap-2 border border-ink/20 bg-paper px-3 py-2 focus-within:border-ink">
            <KeyRound className="h-4 w-4 shrink-0 text-muted" />
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
              placeholder="Minimal 6 karakter"
              autoComplete="new-password"
              className="w-full bg-transparent text-sm text-ink placeholder:text-muted/60 focus:outline-none disabled:opacity-70"
            />
          </div>

          <label
            htmlFor="confirm-password"
            className="mt-4 block font-mono text-[9px] uppercase tracking-[0.18em] text-muted"
          >
            Ulangi kata sandi
          </label>
          <div className="mt-1.5 flex items-center gap-2 border border-ink/20 bg-paper px-3 py-2 focus-within:border-ink">
            <KeyRound className="h-4 w-4 shrink-0 text-muted" />
            <input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              disabled={busy}
              placeholder="Ulangi kata sandi"
              autoComplete="new-password"
              className="w-full bg-transparent text-sm text-ink placeholder:text-muted/60 focus:outline-none disabled:opacity-70"
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-4 border-l-2 border-accent bg-accent/5 py-1.5 pl-2.5 text-[11px] leading-5 text-accent"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 flex h-9 w-full items-center justify-center gap-2 bg-ink font-mono text-[10px] uppercase tracking-[0.16em] text-paper transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" />
            )}
            Simpan kata sandi
          </button>

          <button
            type="button"
            onClick={handleCancel}
            disabled={busy}
            className="mt-3 flex w-full items-center justify-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-40"
          >
            <LogOut className="h-3 w-3" />
            Batal dan kembali ke halaman masuk
          </button>
        </form>
      </div>
    </div>
  );
}
