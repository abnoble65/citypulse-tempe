/**
 * LanguageContext.tsx — App-wide language selection for AI content.
 *
 * Tier 1: AI-generated content translates to the selected language.
 * Static UI labels stay in English. Supports EN, 中文 (Traditional Chinese),
 * and ES (Spanish) per SF Language Access Ordinance.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type AppLanguage = "en" | "zh" | "es";

const LS_KEY = "citypulse_language";

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  setLanguage: () => {},
});

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}

/** Language instruction appended to every AI prompt when language !== "en". */
export function getLanguageInstruction(lang: AppLanguage): string {
  if (lang === "zh")
    return "\n\nWrite your entire response in Traditional Chinese (繁體中文), appropriate for Cantonese-speaking San Francisco residents. Use clear, accessible language.";
  if (lang === "es")
    return "\n\nWrite your entire response in Spanish (Español), appropriate for San Francisco's Latino community. Use clear, accessible language.";
  return "";
}

/** Append language suffix to a cache key. English keeps the original key for backward compat. */
export function langCacheKey(baseKey: string, lang: AppLanguage): string {
  if (lang === "en") return baseKey;
  return `${baseKey}:${lang}`;
}

function readStoredLang(): AppLanguage {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v === "zh" || v === "es") return v;
  } catch { /* ignore */ }
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLangState] = useState<AppLanguage>(readStoredLang);

  const setLanguage = useCallback((lang: AppLanguage) => {
    setLangState(lang);
    try { localStorage.setItem(LS_KEY, lang); } catch { /* ignore */ }
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}
