/**
 * LoginScreen.jsx
 * Gerbang masuk sebelum aplikasi dapat memakai ruang data pribadi.
 *
 * Alur utama: email -> tautan/kode dari Supabase. Google OAuth juga tersedia
 * dan baru aktif setelah provider Google diaktifkan di dashboard Supabase.
 */

import { useState } from "react";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { authRedirectUrl, supabase } from "../supabase";

function friendlyAuthError(message) {
  const text = (message || "").toLowerCase();
  if (text.includes("invalid login credentials")) {
    return "Email atau kata sandi salah.";
  }
  if (text.includes("email not confirmed")) {
    return "Email belum dikonfirmasi. Buka tautan konfirmasi di email, atau minta pemilik aplikasi mengaktifkan konfirmasi otomatis.";
  }
  if (text.includes("password should be")) {
    return "Kata sandi terlalu lemah (minimal 6 karakter).";
  }
  if (text.includes("user already registered")) {
    return "Email ini sudah terdaftar. Masuk lewat tab Tautan email, atau klik Lupa kata sandi.";
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  }
  if (text.includes("signups not allowed") || text.includes("signup is disabled")) {
    return "Pendaftaran akun sedang dinonaktifkan oleh pemilik aplikasi.";
  }
  return message || "Gagal masuk. Coba lagi.";
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.86c2.26-2.09 3.56-5.17 3.56-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28V6.63H1.29a12 12 0 0 0 0 10.74l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.42-3.42A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.63l3.98 3.09C6.22 6.87 8.87 4.76 12 4.76Z"
      />
    </svg>
  );
}

export default function LoginScreen({ onUseAccessKey, initialError = "" }) {
  const [mode, setMode] = useState("link");
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState("");

  function switchMode(nextMode) {
    setMode(nextMode);
    setStep("email");
    setCode("");
    setPassword("");
    setError("");
    setNotice("");
  }

  function handleSubmit(event) {
    if (mode === "password") {
      signInWithPassword(event);
      return;
    }
    if (step === "email") {
      sendLink(event);
      return;
    }
    verifyCode(event);
  }

  async function signInWithPassword(event) {
    event?.preventDefault();
    const address = email.trim();

    if (!address) {
      setError("Masukkan alamat email Anda.");
      return;
    }
    if (!password) {
      setError("Masukkan kata sandi akun Anda.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: address,
      password,
    });

    setBusy(false);

    if (authError) {
      setError(friendlyAuthError(authError.message));
    }
    // onAuthStateChange di App menangani sesi yang baru terbentuk.
  }

  async function signUpWithPassword() {
    const address = email.trim();

    if (!address) {
      setError("Masukkan alamat email Anda.");
      return;
    }
    if (!password) {
      setError("Buat kata sandi minimal 6 karakter.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    const { data, error: authError } = await supabase.auth.signUp({
      email: address,
      password,
      options: { emailRedirectTo: authRedirectUrl() },
    });

    setBusy(false);

    if (authError) {
      setError(friendlyAuthError(authError.message));
      return;
    }

    if (data?.session) {
      // Konfirmasi email dimatikan di Supabase: sesi langsung aktif.
      return;
    }

    if (Array.isArray(data?.user?.identities) && data.user.identities.length === 0) {
      // Supabase tidak memberi tahu apakah email sudah terdaftar (anti-enumerasi).
      // Identitas kosong berarti akun sudah ada; arahkan ke jalur masuk yang tepat.
      setNotice(
        `Email ${address} sepertinya sudah terdaftar. Masuk lewat tab Tautan email, atau klik Lupa kata sandi untuk membuat kata sandi baru.`
      );
      return;
    }

    setNotice(
      `Akun untuk ${address} dibuat. Cek email untuk konfirmasi, lalu masuk kembali dengan kata sandi Anda.`
    );
  }

  async function sendPasswordReset() {
    const address = email.trim();

    if (!address) {
      setError("Isi email Anda dulu, lalu klik Lupa kata sandi.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    const { error: authError } = await supabase.auth.resetPasswordForEmail(
      address,
      { redirectTo: authRedirectUrl() }
    );

    setBusy(false);

    if (authError) {
      setError(friendlyAuthError(authError.message));
      return;
    }

    setNotice(
      `Jika ${address} terdaftar, kami mengirim tautan atur ulang kata sandi. Buka tautan itu untuk membuat kata sandi baru.`
    );
  }

  async function sendLink(event) {
    event?.preventDefault();
    const address = email.trim();

    if (!address) {
      setError("Masukkan alamat email Anda.");
      return;
    }

    setBusy(true);
    setError("");

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        emailRedirectTo: authRedirectUrl(),
        shouldCreateUser: true,
      },
    });

    setBusy(false);

    if (authError) {
      setError(authError.message || "Gagal mengirim email masuk.");
      return;
    }

    setStep("code");
    setNotice(
      `Kami mengirim tautan masuk ke ${address}. Buka tautan itu, atau masukkan kode 6 digit bila tercantum di email.`
    );
  }

  async function verifyCode(event) {
    event.preventDefault();
    const token = code.trim();

    if (token.length < 6) {
      setError("Kode terdiri dari 6 digit.");
      return;
    }

    setBusy(true);
    setError("");

    const { error: authError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    });

    setBusy(false);

    if (authError) {
      setError(authError.message || "Kode tidak valid atau sudah kedaluwarsa.");
      return;
    }

    // onAuthStateChange di App akan menangani sesi yang baru terbentuk.
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError("");

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authRedirectUrl() },
    });

    if (authError) {
      setBusy(false);
      setError(
        authError.message ||
          "Login Google belum aktif. Gunakan email, atau aktifkan provider Google di Supabase."
      );
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
          Masuk ke
          <br />
          <span className="italic text-accent">ruang data Anda.</span>
        </h1>

        <p className="mt-4 text-sm leading-6 text-muted">
          Setiap akun punya tabel sendiri. Data Anda tidak terlihat oleh akun
          lain, dan akun baru mulai dari ruang kosong.
        </p>

        <div className="mt-8 border border-ink/15 bg-surface p-5">
          <div className="mb-5 flex border border-ink/15">
            <button
              type="button"
              onClick={() => switchMode("link")}
              disabled={busy}
              className={`h-8 flex-1 font-mono text-[9px] uppercase tracking-[0.14em] transition-colors disabled:opacity-40 ${
                mode === "link"
                  ? "bg-ink text-paper"
                  : "bg-paper text-muted hover:text-ink"
              }`}
            >
              Tautan email
            </button>
            <button
              type="button"
              onClick={() => switchMode("password")}
              disabled={busy}
              className={`h-8 flex-1 border-l border-ink/15 font-mono text-[9px] uppercase tracking-[0.14em] transition-colors disabled:opacity-40 ${
                mode === "password"
                  ? "bg-ink text-paper"
                  : "bg-paper text-muted hover:text-ink"
              }`}
            >
              Kata sandi
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <label
              htmlFor="auth-email"
              className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted"
            >
              Email
            </label>
            <div className="mt-1.5 flex items-center gap-2 border border-ink/20 bg-paper px-3 py-2 focus-within:border-ink">
              <Mail className="h-4 w-4 shrink-0 text-muted" />
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={step === "code" || busy}
                placeholder="nama@email.com"
                autoComplete="email"
                className="w-full bg-transparent text-sm text-ink placeholder:text-muted/60 focus:outline-none disabled:opacity-70"
              />
            </div>

            {mode === "password" ? (
              <>
                <label
                  htmlFor="auth-password"
                  className="mt-4 block font-mono text-[9px] uppercase tracking-[0.18em] text-muted"
                >
                  Kata sandi
                </label>
                <div className="mt-1.5 flex items-center gap-2 border border-ink/20 bg-paper px-3 py-2 focus-within:border-ink">
                  <Lock className="h-4 w-4 shrink-0 text-muted" />
                  <input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={busy}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full bg-transparent text-sm text-ink placeholder:text-muted/60 focus:outline-none disabled:opacity-70"
                  />
                </div>
              </>
            ) : null}

            {step === "code" ? (
              <>
                <label
                  htmlFor="auth-code"
                  className="mt-4 block font-mono text-[9px] uppercase tracking-[0.18em] text-muted"
                >
                  Kode 6 digit
                </label>
                <input
                  id="auth-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, ""))
                  }
                  placeholder="000000"
                  autoFocus
                  className="mt-1.5 w-full border border-ink/20 bg-paper px-3 py-2 font-mono text-lg tracking-[0.3em] text-ink placeholder:text-muted/40 focus:border-ink focus:outline-none"
                />
              </>
            ) : null}

            {notice ? (
              <p className="mt-4 border-l-2 border-accent pl-2.5 text-[11px] leading-5 text-ink/70">
                {notice}
              </p>
            ) : null}

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
              {mode === "password"
                ? "Masuk"
                : step === "email"
                  ? "Kirim tautan masuk"
                  : "Masuk dengan kode"}
            </button>
          </form>

          {mode === "password" ? (
            <div className="mt-3">
              <p className="text-[11px] leading-5 text-muted">
                Gunakan kata sandi akun Supabase/aplikasi, bukan kata sandi
                Gmail Anda.
              </p>
              <button
                type="button"
                onClick={signUpWithPassword}
                disabled={busy}
                className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-40"
              >
                Belum punya kata sandi? Buat akun
              </button>
              <button
                type="button"
                onClick={sendPasswordReset}
                disabled={busy}
                className="mt-2 block font-mono text-[9px] uppercase tracking-[0.12em] text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-40"
              >
                Lupa kata sandi? Kirim tautan atur ulang
              </button>
            </div>
          ) : null}

          {step === "code" ? (
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError("");
                setNotice("");
              }}
              className="mt-3 w-full font-mono text-[9px] uppercase tracking-[0.14em] text-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Ganti email
            </button>
          ) : null}

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-ink/10" />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
              atau
            </span>
            <span className="h-px flex-1 bg-ink/10" />
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy}
            className="flex h-9 w-full items-center justify-center gap-2.5 border border-ink/20 bg-paper font-mono text-[10px] uppercase tracking-[0.14em] text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <GoogleMark />
            Lanjutkan dengan Google
          </button>
        </div>

        <p className="mt-4 font-mono text-[9px] leading-4 text-muted">
          Dengan masuk, Anda menyetujui bahwa data yang diunggah disimpan di
          ruang akun Anda sendiri.
        </p>

        {onUseAccessKey ? (
          <button
            type="button"
            onClick={onUseAccessKey}
            className="mt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Pemilik aplikasi: masuk dengan kunci akses
          </button>
        ) : null}
      </div>
    </div>
  );
}
