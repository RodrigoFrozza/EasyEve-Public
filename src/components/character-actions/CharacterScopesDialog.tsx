'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Shield, List, AlertTriangle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { EVE_SCOPES, HOLDING_SCOPES } from '@/lib/constants/scopes'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface CharacterScopesDialogProps {
  scopes: string[]
  esiApp?: string
}

export function CharacterScopesDialog({ scopes, esiApp = 'main' }: CharacterScopesDialogProps) {
  const { t } = useTranslations()
  const [open, setOpen] = useState(false)
  const requiredScopes = esiApp === 'holding' ? HOLDING_SCOPES : EVE_SCOPES
  
  const activeScopes = scopes || []
  const missingScopes = requiredScopes.filter(s => !activeScopes.includes(s))
  const hasMissing = missingScopes.length > 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={cn("border-eve-border", hasMissing && "border-red-500/50 text-red-400 hover:bg-red-500/10")}>
          <List className="mr-2 h-4 w-4" />
          Scopes
          {hasMissing && (
            <span className="ml-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-[8px] font-bold text-white">
              !
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-[#0a0a0f] border-zinc-800 text-white p-0 overflow-hidden">
        <div className="p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
              <Shield className="h-5 w-5 text-cyan-400" />
              ESI Scopes Status
            </DialogTitle>
            <DialogDescription className="text-[10px] text-zinc-500 uppercase font-bold">
              Verification for app: <span className="text-white">{esiApp}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {/* Missing Scopes */}
            {missingScopes.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3" /> Missing {missingScopes.length} Permissions
                </h4>
                <div className="grid grid-cols-1 gap-1">
                  {missingScopes.map(s => (
                    <div key={s} className="text-[9px] bg-red-500/5 border border-red-500/20 px-2 py-1.5 rounded-lg text-red-400 font-mono">
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Scopes */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                <CheckCircle className="h-3 w-3" /> Active {activeScopes.length} Permissions
              </h4>
              <div className="grid grid-cols-1 gap-1 opacity-70">
                {activeScopes.map(s => (
                  <div key={s} className="text-[9px] bg-emerald-500/5 border border-emerald-500/20 px-2 py-1.5 rounded-lg text-emerald-400 font-mono">
                    {s}
                  </div>
                ))}
              </div>
            </div>

            {scopes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                 <AlertTriangle className="h-10 w-10 text-zinc-800 mb-2" />
                 <p className="text-xs text-zinc-500 font-bold uppercase">{t('global.noScopesFound')}</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-900 border-dashed">
             <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">
               If permissions are missing, please re-authenticate the character by clicking 
               &quot;Link Character&quot; again. This will refresh and authorize all required scopes.
             </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
