"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { dictionaries, type Dict, type Lang } from "@/lib/i18n/dict";

type Ctx = {
  lang: Lang;
  dict: Dict;
  setLang: (l: Lang) => void;
  toggle: () => void;
  pending: boolean;
};

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({
  initialLang,
  children,
}: {
  initialLang: Lang;
  children: ReactNode;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function setLang(next: Lang) {
    if (next === lang) return;
    setLangState(next); // instant client feedback
    document.cookie = `${"aucta_lang"}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    startTransition(() => router.refresh());
  }

  function toggle() {
    setLang(lang === "en" ? "id" : "en");
  }

  return (
    <LanguageContext.Provider
      value={{
        lang,
        dict: dictionaries[lang],
        setLang,
        toggle,
        pending,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useI18n(): Ctx {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useI18n must be used within LanguageProvider");
  return ctx;
}
