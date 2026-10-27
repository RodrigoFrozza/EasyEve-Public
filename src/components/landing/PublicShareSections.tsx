import { Github, Heart, LogIn, ShieldCheck } from 'lucide-react'
import { DiscordIcon } from '@/components/shared/DiscordIcon'
import { Button } from '@/components/ui/button'
import { EXTERNAL_LINKS } from '@/constants/external-links'

// Shared bottom of the public share pages (/a/[token], /c/[token]): login/Discord
// CTA panel + credit footer. Labels come in already translated so each page keeps
// its own copy (appraisal.* vs characterProfile.share.*) and its own getTranslations.

interface PublicSharePitchProps {
  tag: string
  loginLabel: string
  /** Where the visitor lands after SSO, e.g. '/dashboard/appraisal'. */
  loginCallbackPath: string
  discordLabel: string
  secureLabel: string
}

export function PublicSharePitch({
  tag,
  loginLabel,
  loginCallbackPath,
  discordLabel,
  secureLabel,
}: PublicSharePitchProps) {
  return (
    <div className="eve-public-panel space-y-4 rounded-xs p-6 md:p-8">
      <p className="text-xs font-medium text-eve-accent">{tag}</p>
      <div className="flex flex-wrap gap-3 pt-1">
        <Button asChild variant="eve" size="lg" className="gap-2">
          <a href={`/api/auth/signin?callbackUrl=${encodeURIComponent(loginCallbackPath)}`}>
            <LogIn className="h-4 w-4" />
            {loginLabel}
          </a>
        </Button>
        <Button asChild variant="outline" size="lg" className="gap-2 border-eve-border">
          <a href={EXTERNAL_LINKS.DISCORD} target="_blank" rel="noopener noreferrer">
            <DiscordIcon className="h-4 w-4" />
            {discordLabel}
          </a>
        </Button>
      </div>
      <div className="flex items-center gap-2 pt-1 text-xs text-eve-muted">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70" />
        <span>{secureLabel}</span>
      </div>
    </div>
  )
}

interface PublicShareFooterProps {
  builtByLabel: string
  disclaimer: string
}

export function PublicShareFooter({ builtByLabel, disclaimer }: PublicShareFooterProps) {
  return (
    <footer className="flex flex-col items-center gap-3 border-t border-eve-border/30 pt-6 text-center">
      <p className="flex items-center gap-1.5 text-xs text-eve-muted">
        <Heart className="h-3.5 w-3.5 text-eve-accent" />
        {builtByLabel}{' '}
        <span className="font-semibold text-eve-text">Rodrigo Frozza</span>
      </p>
      <div className="flex items-center gap-4 text-xs text-eve-muted">
        <a
          href={EXTERNAL_LINKS.GITHUB}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 transition-colors hover:text-eve-accent"
        >
          <Github className="h-3.5 w-3.5" />
          GitHub
        </a>
        <a
          href={EXTERNAL_LINKS.DISCORD}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 transition-colors hover:text-eve-accent"
        >
          <DiscordIcon className="h-3.5 w-3.5" />
          Discord
        </a>
      </div>
      <p className="max-w-md text-[10px] leading-relaxed text-eve-muted/70">{disclaimer}</p>
    </footer>
  )
}
