import type { Metadata } from 'next'
import { Inter, Outfit } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { SkipLink } from '@/components/landing/SkipLink'
import { Toaster } from '@/components/toaster'
import { EnvBanner } from '@/components/env-banner'
import { cn } from '@/lib/utils'
import { cookies } from 'next/headers'
import { PUBLIC_APP_URL } from '@/constants/external-links'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const outfit = Outfit({ subsets: ['latin'], variable: '--font-accent' })

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_APP_URL),
  title: "EasyEve, Free EVE Online Management Tool | Mining, Combat & Fleet Tracker",
  description: 'Track your EVE Online characters, mining stats, combat logs and fleet activity, all in one free, open source dashboard.',
  keywords: ['EVE Online', 'Mining Tracker', 'Fleet Management', 'EVE ESI', 'EasyEve'],
  authors: [{ name: 'EasyEve Team' }],
  openGraph: {
    title: 'EasyEve - EVE Online Management Dashboard',
    description: 'The complete free tool for EVE Online players. Mining stats, fleet tracking, and character management.',
    url: PUBLIC_APP_URL,
    siteName: 'EasyEve',
    images: [
      {
        url: `${PUBLIC_APP_URL}/og-image.svg`,
        width: 1200,
        height: 630,
        alt: 'EasyEve Dashboard Preview',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EasyEve - EVE Online Management Dashboard',
    description: 'Track your EVE Online progress with our free management tools.',
    images: [`${PUBLIC_APP_URL}/og-image.svg`],
  },
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
  alternates: {
    canonical: PUBLIC_APP_URL,
  },
  other: {
    'theme-color': '#0f172a',
  },
}

const LOCALE_KEY = 'easyeve-locale'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = cookies()
  const locale = cookieStore.get(LOCALE_KEY)?.value || 'en'
  const isDev = process.env.NEXT_PUBLIC_APP_ENV === 'development'

  return (
    <html lang={locale} className="dark">
      <body className={cn(
        'min-h-screen bg-background font-sans antialiased', 
        inter.variable,
        outfit.variable,
        isDev && 'pt-8'
      )}>
        <SkipLink />
        <EnvBanner />
        <Providers initialLocale={locale}>{children}</Providers>
        <Toaster />
      </body>
    </html>
  )
}