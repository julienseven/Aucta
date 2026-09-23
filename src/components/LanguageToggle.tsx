"use client";

import { useI18n } from "@/components/LanguageProvider";

/* Recognition over recall: a visible, always-available EN / ID switch. */
export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, pending } = useI18n();

  return (
    <div
      role="group"
      aria-label="Language / Bahasa"
      className={`inline-flex items-center rounded-full border border-line bg-canvas p-0.5 ${
        compact ? "text-[0.72rem]" : "text-xs"
      }`}
    >
      {(["en", "id"] as const).map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={active}
            disabled={pending}
            onClick={() => setLang(code)}
            className={`min-h-[32px] rounded-full px-3 font-bold tracking-[0.08em] transition-all duration-200 ${
              active
                ? "bg-ink text-canvas shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            {code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
