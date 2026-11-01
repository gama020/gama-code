import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import ptBR from "./locales/pt-BR.json";
import enUS from "./locales/en-US.json";

export type Locale = "pt-BR" | "en-US";

const STORAGE_KEY = "gama:locale";
const DEFAULT_LOCALE: Locale = "pt-BR";

type Dictionary = Record<string, unknown>;

const dictionaries: Record<Locale, Dictionary> = {
  "pt-BR": ptBR,
  "en-US": enUS,
};

let currentGlobalLocale: Locale = DEFAULT_LOCALE;

if (typeof window !== "undefined") {
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (stored && (stored === "pt-BR" || stored === "en-US")) {
    currentGlobalLocale = stored;
  }
}

function resolveNestedValue(dict: Dictionary, path: string): string | null {
  const parts = path.split(".");
  let current: unknown = dict;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return typeof current === "string" ? current : null;
}

function translate(
  key: string,
  fallback?: string,
  params?: Record<string, string | number>,
  locale: Locale = currentGlobalLocale,
): string {
  const dict = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
  let text = resolveNestedValue(dict, key);

  if (!text && locale !== "en-US") {
    text = resolveNestedValue(dictionaries["en-US"], key);
  }

  if (!text) {
    text = fallback ?? key;
  }

  if (params) {
    for (const [pKey, pVal] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${pKey}\\}`, "g"), String(pVal));
    }
  }

  return text;
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: currentGlobalLocale,
  setLocale: () => {},
  t: (key, fallback, params) => translate(key, fallback, params, currentGlobalLocale),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(currentGlobalLocale);

  const setLocale = (newLocale: Locale) => {
    currentGlobalLocale = newLocale;
    setLocaleState(newLocale);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newLocale);
      document.documentElement.lang = newLocale;
    }
  };

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- synchronizes active document language with DOM
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const t = (key: string, fallback?: string, params?: Record<string, string | number>) => {
    return translate(key, fallback, params, locale);
  };

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  return useContext(I18nContext);
}
