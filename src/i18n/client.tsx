'use client'

import { createContext, useContext, useMemo, useState, useEffect } from 'react'

// Use a more flexible type to allow for missing keys in different locales
type Messages = any // Quick fix for build, ideally should be DeepPartial<typeof en> or similar

const localeLoaders: Record<string, () => Promise<{ default: Messages }>> = {
  en: () => import('./locales/en.json'),
  'pt-BR': () => import('./locales/pt-BR.json'),
  zh: () => import('./locales/zh.json'),
  ja: () => import('./locales/ja.json'),
  ko: () => import('./locales/ko.json'),
}

const translations: Record<string, Messages> = {}
const loadingPromises: Record<string, Promise<Messages>> = {}

async function loadLocale(locale: string): Promise<Messages> {
  if (translations[locale]) return translations[locale]
  
  if (!loadingPromises[locale]) {
    loadingPromises[locale] = localeLoaders[locale]?.()
      .then((module) => {
        translations[locale] = module.default
        return module.default
      })
      .catch(() => {
        delete loadingPromises[locale]
        return translations['en'] || {}
      })
  }
  
  return loadingPromises[locale]
}

type TranslationFunction = (key: string, params?: Record<string, string | number>) => string

interface I18nContextValue {
  locale: string
  setLocale: (locale: string) => void
  t: TranslationFunction
}

const I18nContext = createContext<I18nContextValue | null>(null)

function getNestedValue(obj: unknown, path: string): string | undefined {
  const keys = path.split('.')
  let result: unknown = obj
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = (result as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }
  return typeof result === 'string' ? result : undefined
}

function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`))
}

export function I18nProvider({ children, locale = 'en', onLocaleChange }: { children: React.ReactNode; locale?: string; onLocaleChange?: (locale: string) => void }) {
  const [messages, setMessages] = useState<Messages>(() => translations[locale] || translations['en'] || {})
  const [currentLocale, setCurrentLocale] = useState(locale)

  useEffect(() => {
    if (!translations[locale]) {
      loadLocale(locale).then((msgs) => {
        setMessages(msgs)
        setCurrentLocale(locale)
      })
    } else if (locale !== currentLocale) {
      setMessages(translations[locale])
      setCurrentLocale(locale)
    }
  }, [locale, currentLocale])

  const value = useMemo(() => {
    const t: TranslationFunction = (key, params) => {
      const text = getNestedValue(messages, key) || getNestedValue(translations['en'] || {}, key) || key
      return interpolate(text, params)
    }

    const handleSetLocale = async (newLocale: string) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('easyeve-locale', newLocale)
        try {
          await fetch('/api/settings/preferences', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locale: newLocale })
          })
        } catch (e) {
          console.error('Failed to save locale preference:', e)
        }
      }
      onLocaleChange?.(newLocale)
    }

    return {
      locale: currentLocale,
      setLocale: handleSetLocale,
      t
    }
  }, [messages, currentLocale, onLocaleChange])

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider')
  }
  return context
}

export async function getTranslation(key: string, locale: string = 'en', params?: Record<string, string | number>): Promise<string> {
  if (!translations[locale]) {
    await loadLocale(locale)
  }
  const messages = translations[locale] || translations['en'] || {}
  const text = getNestedValue(messages, key) || getNestedValue(translations['en'] || {}, key) || key
  return interpolate(text, params)
}