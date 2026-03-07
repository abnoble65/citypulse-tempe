/**
 * LanguageSelector.tsx — Compact pill toggle for AI content language.
 *
 * Displays EN | 中文 | ES. On change, clears in-memory AI caches
 * so content regenerates in the new language.
 */

import { useState, useEffect } from "react";
import { useLanguage, type AppLanguage } from "../contexts/LanguageContext";
import { COLORS, FONTS } from "../theme";

const OPTIONS: { value: AppLanguage; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "zh", label: "中文" },
  { value: "es", label: "ES" },
];

const TOAST_MESSAGES: Record<AppLanguage, string> = {
  en: "Switching to English...",
  zh: "切換至中文...",
  es: "Cambiando a Español...",
};

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleChange = (lang: AppLanguage) => {
    if (lang === language) return;
    setLanguage(lang);
    setToast(TOAST_MESSAGES[lang]);
  };

  return (
    <>
      <div style={{
        display: "inline-flex", alignItems: "center",
        border: `1px solid ${COLORS.lightBorder}`,
        borderRadius: 20, overflow: "hidden",
        height: 26,
      }}>
        {OPTIONS.map(({ value, label }) => {
          const active = value === language;
          return (
            <button
              key={value}
              onClick={() => handleChange(value)}
              style={{
                background: active ? COLORS.charcoal : "transparent",
                color: active ? "#fff" : COLORS.midGray,
                border: "none", cursor: "pointer",
                fontFamily: FONTS.body,
                fontSize: 11, fontWeight: active ? 700 : 500,
                padding: "0 10px", height: "100%",
                lineHeight: "26px",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 16, left: "50%",
          transform: "translateX(-50%)", zIndex: 10000,
          background: COLORS.charcoal, color: "#fff",
          fontFamily: FONTS.body, fontSize: 13, fontWeight: 600,
          padding: "8px 20px", borderRadius: 24,
          boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
          animation: "cp-page-in 0.2s ease-out",
          whiteSpace: "nowrap",
        }}>
          {toast}
        </div>
      )}
    </>
  );
}
