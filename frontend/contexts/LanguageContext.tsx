'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Locale, translations, getTranslation, getRouteTitle } from '@/lib/i18n/translations';

interface LanguageContextType {
  locale: Locale;
  setLocale: (loc: Locale) => void;
  t: (key: string, fallback?: string) => string;
  getRouteTitle: (pathname: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LOCAL_STORAGE_LANG_KEY = 'avora_admin_lang';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('vi');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem(LOCAL_STORAGE_LANG_KEY) as Locale;
      if (savedLang === 'vi' || savedLang === 'en') {
        setLocaleState(savedLang);
      }
    }
  }, []);

  const setLocale = useCallback((loc: Locale) => {
    setLocaleState(loc);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_LANG_KEY, loc);
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) => {
      return getTranslation(locale, key, fallback);
    },
    [locale]
  );

  const getPageTitle = useCallback(
    (pathname: string) => {
      return getRouteTitle(pathname, locale);
    },
    [locale]
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, getRouteTitle: getPageTitle }}>
      {children}
    </LanguageContext.Provider>
  );
}

// Fail-safe default context so useLanguage never crashes if called outside a provider
const defaultLanguageContext: LanguageContextType = {
  locale: 'vi',
  setLocale: () => {},
  t: (key: string, fallback?: string) => getTranslation('vi', key, fallback),
  getRouteTitle: (pathname: string) => getRouteTitle(pathname, 'vi'),
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    return defaultLanguageContext;
  }
  return context;
};
