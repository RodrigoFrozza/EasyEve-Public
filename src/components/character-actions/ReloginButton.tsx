'use client'

import { Button } from '@/components/ui/button'
import { Shield } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function ReloginButton({ accountCode }: { accountCode: string }) {
  const router = useRouter()
  
  function handleRelogin() {
    router.push(`/api/auth/signin?link=${accountCode}`)
  }
  
  return (
    <Button 
      variant="outline" 
      size="sm" 
      className="border-eve-accent/50 text-eve-accent hover:bg-eve-accent/10"
      onClick={handleRelogin}
    >
      <Shield className="mr-2 h-4 w-4" />
      Re-Authorize
    </Button>
  )
}
