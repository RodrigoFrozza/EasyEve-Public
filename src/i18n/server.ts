import { cookies } from 'next/headers'
import { getSession } from '@/lib/session'
import en from './locales/en.json'
import ptBR from './locales/pt-BR.json'
import zh from './locales/zh.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'

const translations: Record<string, any> = {
  en,
  'pt-BR': ptBR,
  zh,
  ja,
  ko
}

function getNestedValue(obj: any, path: string): string | undefined {
  const keys = path.split('.')
  let result = obj
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key]
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

export async function getTranslations() {
  const cookieStore = await cookies()
  let locale = cookieStore.get('easyeve-locale')?.value || 'en'

  // Try to get user preferences from session/database
  try {
    const session = await getSession()
    if (session?.user?.id) {
      // Skip database lookup for now - preferences not implemented
    }
  } catch (e) {
    // Ignore errors - just use cookie/localStorage fallback
  }

  const messages = translations[locale] || translations.en

  return {
    t: (key: string, params?: Record<string, string | number>): string => {
      const text = getNestedValue(messages, key) || getNestedValue(translations.en, key) || key
      return interpolate(text, params)
    },
    locale
  }
}
