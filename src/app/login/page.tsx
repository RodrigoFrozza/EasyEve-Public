'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'

function LoginContent() {
  const { t } = useTranslations()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const error = searchParams.get('error')

  const handleLogin = () => {
    window.location.href = `/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-eve-dark p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-eve-accent/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-eve-accent2/10 to-transparent rounded-full blur-3xl" />
      </div>

      <Card className="relative w-full max-w-md border-eve-border bg-eve-panel/80 backdrop-blur">
        <CardHeader className="text-center">
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-eve-accent">
            <span className="text-3xl font-bold text-black">E</span>
            <span className="absolute -right-3 -top-1 rounded bg-white px-1.5 py-0.5 text-[10px] font-bold leading-none text-black">
              {t('common.beta').toUpperCase()}
            </span>
          </div>
          <CardTitle className="text-2xl text-white">{t('global.welcomeToEasyEve')}</CardTitle>
          <CardDescription>
            Your personal EVE Online ERP for tracking characters, fleets, and more
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/50 p-3 text-sm text-red-400">
              {error === 'OAuthAccountNotLinked'
                ? 'This character is already linked to another account.'
                : 'An error occurred during login. Please try again.'}
            </div>
          )}

          {searchParams.get('blocked') === 'true' && (
            <div className="rounded-lg bg-red-500/20 border border-red-500 p-3 text-sm text-red-400 flex flex-col gap-1">
              <p className="font-bold flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                ACCOUNT BLOCKED
              </p>
              <p className="text-xs opacity-80">
                {t('login.reason')} {searchParams.get('reason') || 'Terms violation or administrative pending.'}
              </p>
              <p className="text-[10px] mt-2 italic">
                {t('login.contactDiscord')}
              </p>
            </div>
          )}

          <Button
            onClick={handleLogin}
            className="w-full bg-eve-accent text-black hover:bg-eve-accent/80 h-12 text-base font-semibold"
            size="lg"
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            Login with EVE Online
          </Button>

          <p className="text-center text-xs text-gray-500">
            By logging in, you agree to allow EasyEve to access your EVE Online character data via ESI.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-eve-dark">
        <Loader2 className="h-8 w-8 animate-spin text-eve-accent" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
