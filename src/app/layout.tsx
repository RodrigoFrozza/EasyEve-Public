import type { Metadata } from 'next'
import { Exo_2, Rajdhani } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { SkipLink } from '@/components/landing/SkipLink'
import { Toaster } from '@/components/toaster'
import { EnvBanner } from '@/components/env-banner'
import { cn } from '@/lib/utils'
import { cookies } from 'next/headers'
import { PUBLIC_APP_URL } from '@/constants/external-links'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
  getAccentInlineStyle,
  isAccentColor,
  type AccentColor,
} from '@/lib/theme/accent-palette'

export const dynamic = 'force-dynamic'

const exo2 = Exo_2({ subsets: ['latin'], variable: '--font-sans', weight: ['300', '400', '500', '600', '700'] })
const rajdhani = Rajdhani({ subsets: ['latin'], variable: '--font-accent', weight: ['400', '500', '600', '700'] })

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
        url: `${PUBLIC_APP_URL}/og-image.png`,
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
    images: [`${PUBLIC_APP_URL}/og-image.png`],
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  alternates: {
    canonical: PUBLIC_APP_URL,
  },
  other: {
    'theme-color': '#000000',
  },
}

const LOCALE_KEY = 'easyeve-locale'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = cookies()
  const locale = cookieStore.get(LOCALE_KEY)?.value || 'en'
  const isDev = process.env.NEXT_PUBLIC_APP_ENV === 'development'

  let initialAccentColor: AccentColor | undefined
  const session = await getSession()
  if (session?.user?.id) {
    const profile = await prisma.userProfile.findUnique({
      where: { userId: session.user.id },
      select: { accentColor: true },
    })
    if (isAccentColor(profile?.accentColor)) {
      initialAccentColor = profile.accentColor
    }
  }

  const accentInlineStyle = initialAccentColor
    ? getAccentInlineStyle(initialAccentColor)
    : undefined

  return (
    <html
      lang={locale}
      className={initialAccentColor ? `dark accent-${initialAccentColor}` : 'dark'}
      style={accentInlineStyle}
    >
      <body className={cn(
        'min-h-screen bg-background font-sans antialiased', 
        exo2.variable,
        rajdhani.variable,
        isDev && 'pt-8'
      )}>
        <SkipLink />
        <EnvBanner />
        <Providers initialLocale={locale} initialAccentColor={initialAccentColor}>
          {children}
        </Providers>
        <Toaster />
      </body>
    </html>
  )
}