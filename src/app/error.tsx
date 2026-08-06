'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCcw, Home, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { ErrorCodes, getErrorMessage } from '@/lib/error-codes'
import { extractErrorCode } from '@/lib/api-error'
import { useTranslations } from '@/i18n/hooks'
import { remoteLogger } from '@/lib/remote-logger'

/**
 * Global Error Boundary for the Next.js App Router.
 * This catch-all component handles unhandled runtime errors in the application.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useTranslations()
  const errorCode = extractErrorCode(error) || ErrorCodes.UNKNOWN_ERROR
  const message = getErrorMessage(errorCode)

  useEffect(() => {
    remoteLogger.error('[GLOBAL ERROR]', error, {
      digest: error.digest,
      url: window.location.href,
    })
  }, [error])

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-black px-4 py-12 text-center">
      <div className="max-w-md space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-500/10 p-4">
            <AlertCircle className="h-12 w-12 text-red-500" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">
            {t('error.title')}
          </h1>
          <p className="text-zinc-400 text-base">
            {message}
          </p>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="rounded-md bg-zinc-900 p-4 text-left text-xs overflow-auto max-h-40 border border-zinc-800">
            <p className="font-bold text-red-500 mb-1">Debug Info ({errorCode}):</p>
            <p className="whitespace-pre-wrap text-zinc-300">{error.message}</p>
            {error.digest && (
              <p className="mt-2 text-zinc-500 italic">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            onClick={() => reset()}
            className="bg-white text-black hover:bg-zinc-200 h-11 px-8 rounded-md font-bold transition-none"
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            {t('error.retry')}
          </Button>
          <Button
            onClick={() => window.location.href = '/'}
            variant="outline"
            className="border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 h-11 px-8 rounded-md transition-none"
          >
            <Home className="h-4 w-4 mr-2" />
            {t('error.goHome')}
          </Button>
        </div>

        <div className="mt-8 p-6 rounded-md bg-zinc-900/40 border border-zinc-800">
          <p className="text-sm text-zinc-400 mb-4">
            {t('error.discordInstructions')}
          </p>
          <Button
            asChild
            className="w-full sm:w-auto bg-[#5865F2] hover:bg-[#4752C4] text-white border-none px-8 h-12 rounded-md font-bold transition-none"
          >
            <a href="https://discord.gg/6Tt7XP3JhH" target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-5 w-5 mr-2" />
              {t('error.discordButton')}
            </a>
          </Button>
        </div>

        <div className="pt-4">
          <p className="text-[10px] text-zinc-600 font-medium">
            {t('error.securityPriority')} • Code: {errorCode}
          </p>
        </div>
      </div>
    </div>
  )
}
