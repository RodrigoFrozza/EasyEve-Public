'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Lock } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from '@/i18n/hooks'

interface CharacterInfo {
  id: number
  name: string
  corporation?: {
    name: string
    ticker: string
  } | null
  alliance?: {
    name: string
  } | null
}

interface PrivateProfileClientProps {
  userId: string
  mainCharacter: CharacterInfo | null
}

export function PrivateProfileClient({
  userId,
  mainCharacter,
}: PrivateProfileClientProps) {
  const { t } = useTranslations()
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-md mx-auto">
        <Card className="bg-eve-panel border-eve-border">
          <CardContent className="pt-6 text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-eve-dark flex items-center justify-center">
                <Lock className="h-10 w-10 text-gray-500" />
              </div>
            </div>
            
            <div>
              <h1 className="text-2xl font-bold text-white">
                {mainCharacter?.name || 'Player'}
              </h1>
              {mainCharacter?.corporation && (
                <p className="text-amber-400">
                  [{mainCharacter.corporation.ticker}] {mainCharacter.corporation.name}
                  {mainCharacter.alliance && (
                    <span className="text-gray-500"> • {mainCharacter.alliance.name}</span>
                  )}
                </p>
              )}
            </div>

            <div className="py-4 border-t border-eve-border">
              <div className="flex items-center justify-center gap-2 text-gray-500">
                <Lock className="h-4 w-4" />
                <span className="text-sm">{t('players.privateProfile')}</span>
              </div>
              <p className="text-gray-600 text-sm mt-2">
                {t('players.privateProfileDesc')}
              </p>
            </div>

            <Link 
              href="/dashboard"
              className="inline-block px-4 py-2 bg-eve-accent text-black rounded-lg font-medium hover:bg-eve-accent/90"
            >
              {t('players.backToDashboard')}
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}