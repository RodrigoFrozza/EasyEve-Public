'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface AccountIdCardProps {
  accountCode: string
  label: string
  description: string
}

export function AccountIdCard({ accountCode, label, description }: AccountIdCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(accountCode)
      setCopied(true)
      toast.success('Account ID copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  return (
    <div className="p-4 rounded-lg bg-eve-dark/50 border border-eve-border">
      <p className="font-medium text-white mb-1">{label}</p>
      <p className="text-sm text-gray-400 mb-3">{description}</p>
      <div className="flex items-center gap-2">
        <code className="text-lg font-mono text-cyan-400 bg-black/30 px-3 py-1 rounded">
          {accountCode}
        </code>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleCopy}
          className="h-8 w-8 p-0"
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