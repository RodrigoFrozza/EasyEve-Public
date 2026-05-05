'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'

function LinkCharacterContent() {
  const { t } = useTranslations()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  useEffect(() => {
    const accountCode = searchParams.get('accountCode')
    
    if (accountCode) {
      window.location.href = `/api/auth/signin?link=${accountCode}`
    } else {
      router.push('/login')
    }
  }, [searchParams, router])
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-eve-dark">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-eve-accent mx-auto mb-4" />
        <p className="text-white text-lg">{t('global.redirectingToEve')}</p>
        <p className="text-gray-400 text-sm mt-2">{t('global.pleaseWait')}</p>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-eve-dark">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-eve-accent mx-auto mb-4" />
        <p className="text-white text-lg">Loading...</p>
      </div>
    </div>
  )
}

export default function LinkCharacterPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <LinkCharacterContent />
    </Suspense>
  )
}
