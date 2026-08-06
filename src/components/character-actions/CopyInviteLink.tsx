'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'

export function CopyInviteLink({ accountCode }: { accountCode: string }) {
  const [copied, setCopied] = useState(false)
  
  async function handleCopy() {
    const inviteUrl = `${window.location.origin}/link-character?accountCode=${accountCode}`
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <Button 
      variant="outline" 
      size="sm" 
      className="border-eve-border"
      onClick={handleCopy}
    >
      {copied ? <Check className="mr-2 h-4 w-4 text-green-400" /> : <Copy className="mr-2 h-4 w-4" />}
      {copied ? 'Copied!' : 'Copy Invite Link'}
    </Button>
  )
}
