'use client'

import { useState, useMemo } from 'react'
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { checkSiteSafety, type SiteSafetyResult } from '@/lib/utils'
import { EXPLORATION_SITE_TYPES } from '@/lib/constants/activity-data'
import { 
  Shield, ShieldAlert, ShieldCheck, AlertTriangle, 
  HelpCircle, CheckCircle, XCircle, Search
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SiteSafetyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SiteSafetyModal({ open, onOpenChange }: SiteSafetyModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [siteName, setSiteName] = useState('')
  const [result, setResult] = useState<SiteSafetyResult | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const filteredSites = useMemo(() => {
    if (!searchTerm.trim()) return EXPLORATION_SITE_TYPES.slice(0, 20)
    const term = searchTerm.toLowerCase()
    return EXPLORATION_SITE_TYPES
      .filter(site => site.toLowerCase().includes(term))
      .slice(0, 15)
      .sort()
  }, [searchTerm])

  const handleSelectSite = (site: string) => {
    setSiteName(site)
    setSearchTerm('')
    setShowSuggestions(false)
    setResult(checkSiteSafety(site))
  }

  const handleCheck = () => {
    if (siteName.trim()) {
      setResult(checkSiteSafety(siteName))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCheck()
    }
  }

  const getSafetyIcon = () => {
    if (!result) return <HelpCircle className="h-12 w-12 text-zinc-600" />
    
    switch (result.safety) {
      case 'safe':
        return <ShieldCheck className="h-12 w-12 text-green-500" />
      case 'not_safe':
        return <ShieldAlert className="h-12 w-12 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-12 w-12 text-yellow-500" />
    }
  }

  const getSafetyLabel = () => {
    if (!result) return ''
    switch (result.safety) {
      case 'safe':
        return 'SAFE'
      case 'not_safe':
        return 'DANGEROUS'
      case 'warning':
        return 'CAUTION'
    }
  }

  const getDifficultyStars = () => {
    const stars = []
    const diff = result?.difficulty ?? 0
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span key={i} className={cn(
          "text-lg",
          i <= diff ? "text-cyan-400" : "text-zinc-800"
        )}>★</span>
      )
    }
    return stars
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-widest">
            <Shield className="h-5 w-5 text-cyan-400" />
            Check Site Safety
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500 mt-1">
            Verify if an exploration site is safe to run
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase text-zinc-500">
              Enter site name or select from list
            </Label>
            <div className="relative">
              <Input
                placeholder="Search site..."
                value={searchTerm || siteName}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setSiteName(e.target.value)
                  setShowSuggestions(true)
                  setResult(null)
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={handleKeyDown}
                className="bg-zinc-900 border-zinc-800 text-sm pr-10"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              
              {showSuggestions && searchTerm && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-zinc-700 bg-zinc-900 max-h-[180px] overflow-y-auto">
                  {filteredSites.length > 0 ? (
                    filteredSites.map((site) => (
                      <div
                        key={site}
                        onClick={() => handleSelectSite(site)}
                        className="cursor-pointer px-3 py-2 text-xs hover:bg-zinc-800 text-zinc-300"
                      >
                        {site}
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-zinc-500">
                      No sites found
                    </div>
                  )}
                </div>
              )}
            </div>
            <Button 
              onClick={handleCheck}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
            >
              Check
            </Button>
          </div>

          {result && (
            <div className={cn(
              "p-4 rounded-xl border-2 transition-all animate-in fade-in",
              result.safety === 'safe' && "bg-green-500/10 border-green-500/30",
              result.safety === 'not_safe' && "bg-red-500/10 border-red-500/30",
              result.safety === 'warning' && "bg-yellow-500/10 border-yellow-500/30"
            )}>
              <div className="flex items-center gap-3 mb-3">
                {getSafetyIcon()}
                <div>
                  <p className={cn(
                    "text-lg font-black uppercase tracking-wider",
                    result.safety === 'safe' && "text-green-400",
                    result.safety === 'not_safe' && "text-red-400",
                    result.safety === 'warning' && "text-yellow-400"
                  )}>
                    {getSafetyLabel()}
                  </p>
                  <p className="text-xs text-zinc-400 uppercase">
                    Type: {result.type}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 uppercase">Difficulty</span>
                  <div className="flex gap-0.5">{getDifficultyStars()}</div>
                </div>

                {result.warnings.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-white/10">
                    <p className="text-[9px] text-zinc-500 uppercase">Warnings:</p>
                    <ul className="space-y-1">
                      {result.warnings.map((warning, i) => (
                        <li key={i} className="text-[10px] text-zinc-300 flex items-start gap-1">
                          <AlertTriangle className="h-3 w-3 text-yellow-500 mt-0.5 shrink-0" />
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="text-[9px] text-zinc-600 space-y-1">
            <p className="font-bold uppercase">Quick Reference:</p>
            <div className="grid grid-cols-2 gap-1">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span>Crumbling, Ruined, Decayed</span>
              </div>
              <div className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-500" />
                <span>Forgotten, Unsecured</span>
              </div>
              <div className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-500" />
                <span>Covert, Sleeper Cache</span>
              </div>
              <div className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-500" />
                <span>Drone Sites</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
