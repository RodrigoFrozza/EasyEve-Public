'use client'

import { useTranslation } from '@/i18n/client'

export function useTranslations() {
  const { t, locale, setLocale } = useTranslation()
  return { t, locale, setLocale }
}

const LOCALE_KEY = 'easyeve-locale'

export async function setLocale(newLocale: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCALE_KEY, newLocale)
    document.cookie = `${LOCALE_KEY}=${newLocale}; path=/; max-age=31536000; SameSite=Lax`
    console.log('[i18n] Locale saved:', newLocale)
    
    // Small delay to ensure cookie is set before reload
    await new Promise(resolve => setTimeout(resolve, 100))
    window.location.reload()
  }
}

export function getCurrentLocale(): string {
  if (typeof window !== 'undefined') return 'en'
  return localStorage.getItem(LOCALE_KEY) || 'en'
}