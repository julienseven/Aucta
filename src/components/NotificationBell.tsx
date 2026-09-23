"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { IconBell } from "@/components/icons";

type Item = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

function ago(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function NotificationBell() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  async function load(openOnDone = false) {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.items);
    setUnread(data.unread);
    if (openOnDone) setOpen(true);
  }

  useEffect(() => {
    queueMicrotask(() => void load());
    const id = setInterval(() => load(false), 45_000);
    return () => clearInterval(id);
  }, [pathname]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function toggle() {
    const next = !open;
    if (next) {
      await load(true);
    } else setOpen(next);
  }

  async function markAll() {
    await fetch("/api/notifications", { method: "POST" });
    setItems((it) => it.map((i) => ({ ...i, read: true })));
    setUnread(0);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-label={`Notifications (${unread} unread)`}
        className="icon-btn relative"
      >
        <IconBell size={19} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[1rem] place-items-center rounded-full bg-oxblood px-1 text-[0.6rem] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="modal-panel absolute right-0 top-12 z-[120] w-[min(22rem,88vw)] overflow-hidden rounded-2xl border border-line bg-canvas shadow-[var(--shadow-lift)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-serif text-base">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs font-semibold text-espresso hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-[24rem] overflow-y-auto">
            {items.length === 0 && (
              <li className="px-4 py-8 text-center text-xs text-muted">
                You&apos;re all caught up.
              </li>
            )}
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.link ?? "/notifications"}
                  onClick={() => {
                    setOpen(false);
                    fetch(`/api/notifications/${n.id}`, { method: "POST" });
                    setUnread((u) => Math.max(0, u - (n.read ? 0 : 1)));
                  }}
                  className={`flex gap-3 border-b border-line-soft px-4 py-3 transition-colors hover:bg-cream ${
                    n.read ? "" : "bg-cream/50"
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      n.read ? "bg-line" : "bg-bronze"
                    }`}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-ink">
                      {n.title}
                    </span>
                    <span className="line-clamp-2 text-[0.7rem] leading-relaxed text-muted">
                      {n.body}
                    </span>
                    <span className="mt-0.5 block text-[0.64rem] text-faint">
                      {ago(n.createdAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-line px-4 py-2.5 text-center text-xs font-semibold text-espresso hover:bg-cream"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}
