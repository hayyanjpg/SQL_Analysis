import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { ArrowUpRight, KeyRound, LogOut, RotateCcw } from "lucide-react";
import AccessKeyModal from "./components/AccessKeyModal";
import AssistantMessage from "./components/AssistantMessage";
import DatasetSelector from "./components/DatasetSelector";
import LoginScreen from "./components/LoginScreen";
import ToastStack from "./components/ToastStack";
import UploadDataset from "./components/UploadDataset";
import { ENDPOINTS, UNAUTHORIZED_EVENT } from "./api";
import { supabase, supabaseConfigured } from "./supabase";
import { getErrorMessage } from "./utils/errors";

const SELECTION_STORAGE_KEY = "sift.selectedTables";

const SUGGESTIONS = [
  {
    label: "Pendapatan per kategori",
    question: "Berapa total penjualan per kategori produk?",
  },
  {
    label: "Tren bulanan 2026",
    question: "Tampilkan total penjualan per bulan tahun 2026",
  },
  {
    label: "Pelanggan teratas",
    question: "Siapa 5 pelanggan dengan total pembelian terbesar?",
  },
  {
    label: "Produk terlaris",
    question: "Produk apa yang paling banyak terjual?",
  },
];

function createId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

function padRun(number) {
  return String(number ?? 0).padStart(2, "0");
}

const rowCountFormatter = new Intl.NumberFormat("id-ID");

function formatRowCount(value) {
  return typeof value === "number"
    ? rowCountFormatter.format(value)
    : String(value ?? "—");
}

/** Pilihan tabel bertahan saat halaman dimuat ulang, terpisah per akun. */
function readStoredSelection(storageKey = SELECTION_STORAGE_KEY) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item) => typeof item === "string" && item.trim());
  } catch {
    return [];
  }
}

function Welcome({ onPick }) {
  return (
    <section className="animate-fade-up pb-4 lg:pt-8">
      <div className="flex items-center gap-3">
        <span className="h-px w-10 bg-ink" />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
          Mulai dari sini
        </span>
      </div>

      <h1 className="mt-6 font-display text-[2.85rem] leading-[0.93] tracking-[-0.02em] sm:text-6xl lg:text-7xl">
        Tanya datanya.
        <br />
        <span className="italic text-accent">Bukan query-nya.</span>
      </h1>

      <p className="mt-5 max-w-xl text-sm leading-6 text-muted sm:text-[15px]">
        Tulis pertanyaan seperti Anda menjelaskan ke rekan tim. SIFT
        menerjemahkannya menjadi SQL, menjalankannya ke PostgreSQL, lalu
        menyusun tabel dan grafik.
      </p>

      <div className="mt-10 border-t border-ink/15">
        {SUGGESTIONS.map((item, index) => (
          <button
            key={item.question}
            type="button"
            onClick={() => onPick(item.question)}
            className="group -mx-3 flex w-[calc(100%+1.5rem)] items-center gap-4 border-b border-ink/15 px-3 py-4 text-left transition-colors hover:bg-ink hover:text-paper"
          >
            <span className="w-6 shrink-0 font-mono text-[10px] tabular-nums text-muted group-hover:text-paper/50">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold sm:text-[15px]">
                {item.label}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted group-hover:text-paper/60">
                {item.question}
              </span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-paper" />
          </button>
        ))}
      </div>

      <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
        Klik contoh di atas atau tulis pertanyaan sendiri
      </p>
    </section>
  );
}

function Sidebar({
  onPick,
  loading,
  tables = [],
  selectedTables = [],
  workspace = "",
}) {
  const activeScope = new Set(
    selectedTables.length > 0
      ? selectedTables
      : tables.map((item) => item.table)
  );

  return (
    <aside className="scrollbar-thin hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-ink/15 px-5 py-6 lg:flex xl:w-72">
      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
          Contoh pertanyaan
        </p>
        <div className="mt-2">
          {SUGGESTIONS.map((item, index) => (
            <button
              key={item.question}
              type="button"
              onClick={() => onPick(item.question)}
              disabled={loading}
              className="group flex w-full items-baseline gap-3 border-b border-ink/10 py-2.5 text-left disabled:opacity-40"
            >
              <span className="font-mono text-[9px] tabular-nums text-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-xs font-medium leading-5 text-ink/80 transition-colors group-hover:text-accent">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
            Skema
          </p>
          <span className="font-mono text-[9px] tabular-nums text-muted">
            {tables.length} tabel
          </span>
        </div>

        <div className="mt-3 space-y-3.5">
          {tables.length === 0 ? (
            <p className="font-mono text-[9px] leading-4 text-muted">
              Belum ada tabel. Unggah CSV, Excel, atau SQL untuk mulai.
            </p>
          ) : (
            tables.map((item) => {
              const active = activeScope.has(item.table);

              return (
                <div
                  key={item.table}
                  className={`border-l-2 pl-2.5 ${
                    active ? "border-l-accent" : "border-l-transparent"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="break-all font-mono text-[10px] font-medium text-ink">
                      {item.table}
                    </p>
                    {item.row_count != null ? (
                      <span className="shrink-0 font-mono text-[9px] tabular-nums text-muted">
                        {formatRowCount(item.row_count)} b.
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 break-words font-mono text-[9px] leading-4 text-muted">
                    {item.columns?.length
                      ? item.columns.map((column) => column.name).join(" · ")
                      : "kolom tidak dilaporkan"}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {tables.length > 0 ? (
          <p className="mt-3 font-mono text-[8px] uppercase tracking-[0.14em] text-muted/70">
            Tanda oranye = masuk cakupan
          </p>
        ) : null}
      </div>

      <div className="mt-auto pt-8">
        <div className="border border-ink/15 bg-surface p-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
            Catatan
          </p>
          <p className="mt-1.5 text-[11px] leading-5 text-ink/70">
            SELECT berjalan read-only. INSERT, UPDATE, dan DELETE hanya
            dieksekusi setelah Anda menyetujuinya.
          </p>
          {workspace ? (
            <p
              className="mt-2 break-all border-t border-ink/10 pt-2 font-mono text-[8px] uppercase tracking-[0.12em] text-muted"
              title={`Schema PostgreSQL milik akun ini: ${workspace}`}
            >
              Ruang data · {workspace}
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function UserMessage({ content, scope = [] }) {
  return (
    <div className="animate-fade-up border-t border-ink/15 pt-5">
      <div className="flex items-baseline justify-between gap-6">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
          Pertanyaan
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-accent">
          Anda
        </span>
      </div>
      <p className="mt-2 max-w-3xl font-display text-2xl leading-snug tracking-[-0.01em] sm:text-3xl">
        {content}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
        <span>Cakupan:</span>
        {scope.length === 0 ? (
          <span className="border border-ink/15 px-1.5 py-0.5 text-ink/70">
            semua tabel
          </span>
        ) : (
          scope.map((name) => (
            <span
              key={name}
              className="border border-ink/15 px-1.5 py-0.5 text-ink/70"
            >
              {name}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function LoadingMessage() {
  return (
    <div className="animate-fade-up border-t border-ink/15 pt-5">
      <div className="flex items-center gap-2.5">
        <span className="h-1.5 w-1.5 animate-blink bg-accent" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em]">
          Menjalankan query
        </span>
      </div>

      <div className="mt-4 h-px w-full overflow-hidden bg-rule">
        <div className="h-px w-1/3 animate-progress bg-accent" />
      </div>

      <p className="mt-3 text-xs leading-5 text-muted">
        Menerjemahkan pertanyaan → validasi keamanan → menyiapkan hasil
      </p>
    </div>
  );
}

export default function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tables, setTables] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState("");
  const [selectedTables, setSelectedTables] = useState([]);
  const [selectionKey, setSelectionKey] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [accessKeyOpen, setAccessKeyOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [legacyBypass, setLegacyBypass] = useState(false);
  const [workspace, setWorkspace] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const runCounter = useRef(0);
  const toastTimers = useRef(new Map());

  const userId = session?.user?.id ?? null;

  // Sesi Supabase: dibaca sekali, lalu diperbarui lewat listener.
  useEffect(() => {
    if (!supabase) return undefined;

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data?.session ?? null);
      setAuthReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession ?? null);
      setAuthReady(true);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // Ganti akun = ganti ruang data, pilihan tabel, dan percakapan.
  useEffect(() => {
    const key = userId
      ? `${SELECTION_STORAGE_KEY}.${userId}`
      : SELECTION_STORAGE_KEY;

    setSelectionKey(key);
    setSelectedTables(readStoredSelection(key));
    setMessages([]);
    setTables([]);
    setTablesError("");
    setWorkspace("");
    runCounter.current = 0;

    if (!userId) return undefined;

    let active = true;
    axios
      .get(ENDPOINTS.authMe, { timeout: 30000 })
      .then(({ data }) => {
        if (active) setWorkspace(data?.workspace || "");
      })
      .catch((error) => {
        if (active) setTablesError(getErrorMessage(error));
      });

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!selectionKey) return;

    try {
      window.localStorage.setItem(
        selectionKey,
        JSON.stringify(selectedTables)
      );
    } catch {
      // localStorage bisa diblokir (mode privat); abaikan saja.
    }
  }, [selectedTables, selectionKey]);

  useEffect(() => {
    const timers = toastTimers.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  // Backend merespons 401. Saat login aktif, jangan minta kunci bersama.
  useEffect(() => {
    function handleUnauthorized() {
      if (supabaseConfigured && session) {
        setTablesError("Sesi login berakhir. Silakan masuk lagi.");
        return;
      }
      setAccessKeyOpen(true);
    }

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () =>
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [session]);

  function pushToast(tone, message) {
    if (!message) return;

    const id = createId();
    setToasts((previous) => [...previous.slice(-3), { id, tone, message }]);

    const timer = window.setTimeout(
      () => {
        setToasts((previous) => previous.filter((toast) => toast.id !== id));
        toastTimers.current.delete(id);
      },
      tone === "error" ? 8000 : 5000
    );

    toastTimers.current.set(id, timer);
  }

  function dismissToast(id) {
    const timer = toastTimers.current.get(id);
    if (timer) window.clearTimeout(timer);
    toastTimers.current.delete(id);
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }

  /**
   * Ambil daftar tabel (nama, kolom, jumlah baris) dari backend.
   * Ini satu-satunya sumber daftar tabel: tidak ada skema hardcoded di UI.
   */
  async function loadTables() {
    setTablesLoading(true);

    try {
      const { data } = await axios.get(ENDPOINTS.tables, { timeout: 60000 });
      const list = Array.isArray(data) ? data : [];

      setTables(list);
      setTablesError("");

      // Buang pilihan yang tabelnya sudah tidak ada (mis. setelah reset).
      const available = new Set(list.map((item) => item.table));
      setSelectedTables((previous) => {
        const next = previous.filter((name) => available.has(name));
        return next.length === previous.length ? previous : next;
      });
    } catch (error) {
      setTablesError(getErrorMessage(error));
    } finally {
      setTablesLoading(false);
    }
  }

  useEffect(() => {
    if (!authReady) return;
    if (supabaseConfigured && !session && !legacyBypass) return;
    loadTables();
    // Dimuat saat status login siap atau akun berganti; refresh manual lewat
    // pemilih tabel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, userId, legacyBypass]);

  function handleUploadSuccess(result) {
    pushToast("success", result?.message || "Upload selesai.");

    if (result?.kind === "sql_script") {
      pushToast(
        "info",
        "Skema database diperbarui. Tabel baru langsung muncul di pemilih tabel."
      );
    }

    // Tabel hasil upload (atau append) harus langsung terlihat di pemilih.
    loadTables();
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleUploadError(message) {
    pushToast("error", message);
  }

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function sendQuestion(rawQuestion) {
    const question = String(rawQuestion ?? "").trim();
    if (!question || loading) return;

    // Snapshot pilihan tabel: pesan ini tetap memakai cakupan yang sama
    // walaupun pengguna mengubah pilihan sebelum menyetujui DML.
    const scope = selectedTables.length > 0 ? [...selectedTables] : [];

    setInput("");
    setMessages((previous) => [
      ...previous,
      { id: createId(), role: "user", content: question, scope },
    ]);
    setLoading(true);

    try {
      const { data } = await axios.post(
        ENDPOINTS.ask,
        scope.length > 0 ? { question, tables: scope } : { question },
        { timeout: 120000 }
      );
      runCounter.current += 1;
      setMessages((previous) => [
        ...previous,
        {
          id: createId(),
          role: "assistant",
          runNo: runCounter.current,
          data,
          tables: scope,
        },
      ]);
    } catch (error) {
      runCounter.current += 1;
      setMessages((previous) => [
        ...previous,
        {
          id: createId(),
          role: "assistant",
          runNo: runCounter.current,
          error: getErrorMessage(error),
          tables: scope,
        },
      ]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendQuestion(input);
  }

  function handleKeyDown(event) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      sendQuestion(input);
    }
  }

  function clearChat() {
    setMessages([]);
    setInput("");
    runCounter.current = 0;
    inputRef.current?.focus();
  }

  async function handleSignOut() {
    if (!supabase) return;

    try {
      await supabase.auth.signOut();
    } finally {
      setSession(null);
      setTables([]);
      setSelectedTables([]);
      setMessages([]);
      setWorkspace("");
      setTablesError("");
    }
  }

  const isIdle = messages.length === 0 && !loading;

  if (!authReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        Memeriksa sesi…
      </div>
    );
  }

  if (supabaseConfigured && !session && !legacyBypass) {
    return (
      <LoginScreen
        onUseAccessKey={() => {
          setLegacyBypass(true);
          setAccessKeyOpen(true);
        }}
      />
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper text-ink">
      <div className="grain" aria-hidden="true" />

      {/* Aksen tipis di paling atas */}
      <div className="h-[3px] w-full shrink-0 bg-ink">
        <div className="h-full w-16 bg-accent" />
      </div>

      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-ink/15 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center bg-ink text-paper">
            <span className="font-display text-xl leading-none">S</span>
          </div>
          <div className="leading-tight">
            <p className="text-sm font-extrabold tracking-[-0.02em]">
              SIFT<span className="text-accent">.</span>
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted">
              Text → SQL desk
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted md:flex">
          <span>PostgreSQL</span>
          <span className="text-rule">/</span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 bg-moss" />
            SELECT + izin DML
          </span>
        </div>

        <div className="flex items-center gap-2">
          {session?.user?.email ? (
            <span
              className="hidden max-w-[180px] truncate font-mono text-[9px] tracking-normal text-muted sm:inline"
              title={session.user.email}
            >
              {session.user.email}
            </span>
          ) : null}

          {session ? (
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Keluar dari akun"
              className="flex items-center gap-2 border border-ink/20 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-ink hover:bg-ink hover:text-paper"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAccessKeyOpen(true)}
              aria-label="Atur kunci akses"
              className="flex items-center gap-2 border border-ink/20 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-ink hover:bg-ink hover:text-paper"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Kunci akses</span>
            </button>
          )}

          <UploadDataset
            onSuccess={handleUploadSuccess}
            onError={handleUploadError}
          />

          <button
            type="button"
            onClick={clearChat}
            disabled={loading || messages.length === 0}
            className="flex items-center gap-2 border border-ink/20 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-ink hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-35"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidebar
          onPick={sendQuestion}
          loading={loading}
          tables={tables}
          selectedTables={selectedTables}
          workspace={workspace}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <main
            ref={scrollRef}
            className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-7 sm:px-6 lg:px-8"
          >
            <div className="mx-auto w-full max-w-4xl space-y-9">
              {isIdle ? <Welcome onPick={sendQuestion} /> : null}

              {messages.map((message) =>
                message.role === "user" ? (
                  <UserMessage
                    key={message.id}
                    content={message.content}
                    scope={message.scope}
                  />
                ) : (
                  <AssistantMessage
                    key={message.id}
                    message={message}
                    tables={message.tables}
                  />
                )
              )}

              {loading ? <LoadingMessage /> : null}
            </div>
          </main>

          <footer className="shrink-0 border-t border-ink/15 bg-paper px-4 py-3.5 sm:px-6 lg:px-8">
            <form onSubmit={handleSubmit} className="mx-auto w-full max-w-4xl">
              <div className="border border-ink/20 bg-surface transition-[border-color,box-shadow] focus-within:border-ink focus-within:shadow-hard">
                <DatasetSelector
                  tables={tables}
                  selected={selectedTables}
                  onChange={setSelectedTables}
                  loading={tablesLoading}
                  error={tablesError}
                  onRefresh={loadTables}
                />

                <label htmlFor="question" className="sr-only">
                  Pertanyaan tentang data
                </label>
                <textarea
                  id="question"
                  ref={inputRef}
                  rows={2}
                  maxLength={2000}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Tanya apa saja tentang data Anda..."
                  autoComplete="off"
                  autoFocus
                  className="block w-full resize-none bg-transparent px-3.5 pb-2 pt-3 text-[15px] leading-6 text-ink placeholder:text-muted/60 focus:outline-none sm:px-4 sm:text-base"
                />

                <div className="flex items-center justify-between gap-3 border-t border-ink/10 px-3 py-2 sm:px-4">
                  <span className="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-muted sm:inline">
                    Enter kirim · Shift+Enter baris baru
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted sm:hidden">
                    {input.length}/2000
                  </span>

                  <div className="flex items-center gap-3">
                    <span className="hidden font-mono text-[9px] tabular-nums text-muted sm:inline">
                      {input.length}/2000
                    </span>
                    <button
                      type="submit"
                      disabled={!input.trim() || loading}
                      className="flex h-8 items-center gap-1.5 bg-ink px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-paper transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      {loading ? "Proses" : "Jalankan"}
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <p className="mt-2 flex items-center justify-between gap-4 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                <span>SELECT langsung · perubahan data butuh izin</span>
                <span className="hidden sm:inline">Gemini + PostgreSQL</span>
              </p>
            </form>
          </footer>
        </div>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <AccessKeyModal
        open={accessKeyOpen && !session}
        onClose={() => setAccessKeyOpen(false)}
        onSaved={(value) => {
          pushToast(
            value ? "success" : "info",
            value ? "Kunci akses disimpan." : "Kunci akses dihapus."
          );

          // Setelah kunci benar, daftar tabel bisa langsung dimuat.
          if (value) loadTables();
        }}
      />

      {loading ? <span className="sr-only">Sedang memproses pertanyaan</span> : null}
      {messages.length > 0 ? (
        <span className="sr-only">
          Percakapan berisi {messages.length} pesan, run terakhir{" "}
          {padRun(runCounter.current)}
        </span>
      ) : null}
    </div>
  );
}
