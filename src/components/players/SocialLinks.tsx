'use client'

import { Globe, MessageSquare, ExternalLink } from 'lucide-react'
import { DiscordIcon } from '@/components/shared/DiscordIcon'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SocialLinksProps {
  discordUrl?: string | null
  websiteUrl?: string | null
  className?: string
}

export function SocialLinks({ discordUrl, websiteUrl, className }: SocialLinksProps) {
  if (!discordUrl && !websiteUrl) return null

  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {discordUrl && (
        <Button
          variant="outline"
          asChild
          className="h-10 px-4 bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-500/40 rounded-xl font-outfit text-[10px] font-black uppercase tracking-widest transition-all duration-300"
        >
          <a href={discordUrl} target="_blank" rel="noopener noreferrer">
            <DiscordIcon className="h-3 w-3 mr-2" />
            Discord
          </a>
        </Button>
      )}
      
      {websiteUrl && (
        <Button
          variant="outline"
          asChild
          className="h-10 px-4 bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/40 rounded-xl font-outfit text-[10px] font-black uppercase tracking-widest transition-all duration-300"
        >
          <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
            <Globe className="h-3 w-3 mr-2" />
            Website
          </a>
        </Button>
      )}
    </div>
  )
}
