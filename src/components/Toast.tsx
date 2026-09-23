"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; text: string };

const ToastContext = createContext<{
  toast: (text: string, kind?: ToastKind) => void;
} | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { toast: () => {} };
  return ctx;
}

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setItems((cur) => {
      const el = document.querySelector(`[data-toast-id="${id}"]`);
      el?.classList.add("is-leaving");
      return cur;
    });
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 260);
  }, []);

  const toast = useCallback(
    (text: string, kind: ToastKind = "success") => {
      const id = ++counter;
      setItems((cur) => [...cur.slice(-2), { id, kind, text }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), 3600),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach(clearTimeout);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[130] flex flex-col items-center gap-2 px-4"
      >
        {items.map((t) => (
          <div
            key={t.id}
            data-toast-id={t.id}
            className="toast pointer-events-auto flex items-center gap-3 rounded-full border border-line bg-canvas py-2.5 pl-3 pr-4 text-sm font-medium text-ink-soft shadow-[var(--shadow-lift)]"
            role="status"
          >
            <ToastMark kind={t.kind} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastMark({ kind }: { kind: ToastKind }) {
  if (kind === "success")
    return (
      <span className="toast-check grid h-6 w-6 place-items-center rounded-full bg-success text-white">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 12.5l5 5L20 6.5"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  if (kind === "error")
    return (
      <span className="grid h-6 w-6 place-items-center rounded-full bg-oxblood text-white">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  return (
    <span className="grid h-6 w-6 place-items-center rounded-full bg-info text-white">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <path d="M12 8h.01M12 11v5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}
