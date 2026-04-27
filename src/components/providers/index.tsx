'use client'

import { LogManager } from './LogManager'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { I18nProvider } from '@/i18n/client'
import { ThemeProvider } from './theme-provider'

import { ErrorBoundary } from '@/components/shared/ErrorBoundary'

const LOCALE_KEY = 'easyeve-locale'

function getStoredLocale(): string {
  if (typeof window === 'undefined') return 'en'
  return localStorage.getItem(LOCALE_KEY) || 'en'
}

function I18nProviderWrapper({ 
  children, 
  initialLocale 
}: { 
  children: React.ReactNode; 
  initialLocale: string 
}) {
  const [locale, setLocale] = useState<string>(initialLocale)

  return (
    <I18nProvider locale={locale} onLocaleChange={setLocale}>
      {children}
    </I18nProvider>
  )
}

export function Providers({ 
  children, 
  initialLocale = 'en' 
}: { 
  children: React.ReactNode; 
  initialLocale?: string 
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProviderWrapper initialLocale={initialLocale}>
        <ThemeProvider>
          <ErrorBoundary name="GlobalApp">
            <LogManager />
            {children}
          </ErrorBoundary>
        </ThemeProvider>
      </I18nProviderWrapper>
    </QueryClientProvider>
  )
}
