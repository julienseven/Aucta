"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatRupiah } from "@/lib/format";
import { useI18n } from "@/components/LanguageProvider";

export type RecentItem = {
  id: string;
  slug: string;
  title: string;
  image: string;
  status: string;
  current: number;
  sold: number | null;
};

const KEY = "aucta:recent";

function read(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function recordView(item: RecentItem) {
  if (typeof window === "undefined") return;
  const items = read().filter((i) => i.id !== item.id);
  items.unshift(item);
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, 12)));
}

/* Silent recorder placed on lot pages. */
export function RecordView({ item }: { item: RecentItem }) {
  useEffect(() => {
    recordView(item);
  }, [item.id]);
  return null;
}

export function RecentlyViewedRail() {
  const { dict } = useI18n();
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    const local = read();
    if (!local.length) return;
    queueMicrotask(() => setItems(local.slice(0, 8)));
  }, []);

  if (!items.length) return null;

  return (
    <section className="mx-auto w-full max-w-[94rem] px-4 pb-16 sm:px-6 lg:px-10">
      <h2 className="mb-5 font-serif text-2xl">Recently viewed</h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {items.map((it) => (
          <Link
            key={it.id}
            href={`/auctions/${it.slug}`}
            className="group w-44 shrink-0 rounded-card border border-line bg-canvas transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-card)] sm:w-auto"
          >
            <div className="relative aspect-square overflow-hidden rounded-t-card bg-soft">
              <Image
                src={it.image}
                alt={it.title}
                fill
                sizes="(max-width:640px) 45vw, 19vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </div>
            <div className="p-3">
              <p className="line-clamp-2 text-xs font-semibold leading-snug">
                {it.title}
              </p>
              <p className="mt-1.5 font-mono text-xs font-semibold">
                {formatRupiah(it.sold ?? it.current)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
