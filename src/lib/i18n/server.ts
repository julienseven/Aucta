import "server-only";
import { cookies } from "next/headers";
import { dictionaries, type Dict, type Lang, LANGS } from "@/lib/i18n/dict";

export const LANG_COOKIE = "aucta_lang";

export async function getLang(): Promise<Lang> {
  const jar = await cookies();
  const value = jar.get(LANG_COOKIE)?.value;
  return LANGS.includes(value as Lang) ? (value as Lang) : "en";
}

export async function getDict(): Promise<{ lang: Lang; dict: Dict }> {
  const lang = await getLang();
  return { lang, dict: dictionaries[lang] };
}
