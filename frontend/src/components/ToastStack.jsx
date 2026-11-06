import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

const TONES = {
  success: {
    label: "Berhasil",
    Icon: CheckCircle2,
    iconClass: "text-moss",
    edge: "border-l-moss",
  },
  error: {
    label: "Gagal",
    Icon: AlertTriangle,
    iconClass: "text-accent",
    edge: "border-l-accent",
  },
  info: {
    label: "Info",
    Icon: Info,
    iconClass: "text-ink",
    edge: "border-l-ink",
  },
};

/**
 * Toast stack: muncul di bawah header, menumpuk dari atas.
 * Setiap toast menutup dirinya sendiri (timer dikelola App).
 */
export default function ToastStack({ toasts = [], onDismiss }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-3 top-16 z-[70] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-[23rem]"
    >
      {toasts.map((toast) => {
        const tone = TONES[toast.tone] ?? TONES.info;
        const { Icon } = tone;

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto animate-fade-up border border-ink/20 border-l-4 bg-surface px-3 py-2.5 shadow-hard ${tone.edge}`}
          >
            <div className="flex items-start gap-2.5">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.iconClass}`} />

              <div className="min-w-0 flex-1">
                <p
                  className={`font-mono text-[9px] uppercase tracking-[0.16em] ${tone.iconClass}`}
                >
                  {tone.label}
                </p>
                <p className="mt-1 break-words text-xs leading-5 text-ink/80">
                  {toast.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onDismiss?.(toast.id)}
                aria-label="Tutup notifikasi"
                className="-mr-1 -mt-1 shrink-0 p-1 text-muted transition-colors hover:text-accent"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
