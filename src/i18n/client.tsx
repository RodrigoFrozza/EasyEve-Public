'use client'

import { createContext, useContext, useMemo } from 'react'
import en from './locales/en.json'
import ptBR from './locales/pt-BR.json'
import zh from './locales/zh.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'

// Use a more flexible type to allow for missing keys in different locales
type Messages = any // Quick fix for build, ideally should be DeepPartial<typeof en> or similar

const translations: Record<string, Messages> = {
  en,
  'pt-BR': ptBR,
  zh,
  ja,
  ko
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
  const value = useMemo(() => {
    const messages = translations[locale] || translations.en

    const t: TranslationFunction = (key, params) => {
      const text = getNestedValue(messages, key) || getNestedValue(translations.en, key) || key
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
      locale,
      setLocale: handleSetLocale,
      t
    }
  }, [locale, onLocaleChange])

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

export function getTranslation(key: string, locale: string = 'en', params?: Record<string, string | number>): string {
  const messages = translations[locale] || translations.en
  const text = getNestedValue(messages, key) || getNestedValue(translations.en, key) || key
  return interpolate(text, params)
}