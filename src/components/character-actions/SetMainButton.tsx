'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-error'

export function SetMainButton({ characterId, isMain }: { characterId: number, isMain: boolean }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  
  async function handleSetMain() {
    if (isMain) return
    setLoading(true)
    try {
      const { error } = await apiClient.post('/api/characters/set-main', { characterId }, {
        showToast: true
      })
      
      if (!error) {
        router.refresh()
      }
    } catch (error) {
      console.error('Set main error:', error)
    }
    setLoading(false)
  }
  
  return (
    <Button 
      variant="outline" 
      size="sm" 
      className="border-eve-accent/50 text-eve-accent hover:bg-eve-accent/10"
      onClick={handleSetMain}
      disabled={loading || isMain}
    >
      <Star className="mr-2 h-4 w-4" />
      {isMain ? 'Main' : 'Set as Main'}
    </Button>
  )
}
