'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/hooks'

interface AccountIdCardProps {
  accountCode: string
  label: string
  description: string
}

export function AccountIdCard({ accountCode, label, description }: AccountIdCardProps) {
  const { t } = useTranslations()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(accountCode)
      setCopied(true)
      toast.success(t('settings.accountIdCopied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('settings.accountIdCopyError'))
    }
  }

  return (
    <div className="ta-panel p-[18px]">
      <p className="font-accent text-[10px] font-semibold uppercase tracking-[0.15em] text-ta-muted">{label}</p>
      <p className="mt-1 text-sm text-ta-secondary">{description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="rounded-[8px] border border-dashed border-eve-accent/[0.34] bg-ta-inset px-3 py-1.5 font-sans text-lg font-bold tracking-[0.1em] text-eve-accent">
          {accountCode}
        </code>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-9 w-9 p-0 text-ta-muted hover:text-eve-accent"
          aria-label={t('settings.accountIdCopyAria')}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-400" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
