import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { HelpCircle, Shield, Zap, TrendingUp, Info } from "lucide-react"
import { ANOMALY_INTEL } from "@/lib/constants/activity-data"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface AnomaliesIntelDialogProps {
  anomalyName: string
}

export function AnomaliesIntelDialog({ anomalyName }: AnomaliesIntelDialogProps) {
  const intel = ANOMALY_INTEL[anomalyName]

  if (!intel) return null

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors">
          <HelpCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] border-primary/20 bg-background/95 backdrop-blur-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-full">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle className="text-xl font-outfit tracking-tight">{anomalyName}</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground/80">
            Tactical intelligence and wave breakdown for this site.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            {/* Waves section */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-primary">
                <Zap className="h-4 w-4" />
                Wave Breakdown
              </h4>
              <div className="grid gap-2">
                {intel.waves.map((wave, index) => (
                  <div key={index} className="text-sm p-3 bg-muted/40 rounded-lg border border-border/50 hover:bg-muted/60 transition-colors">
                    {wave}
                  </div>
                ))}
              </div>
            </div>

            {/* Notable NPCs */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-orange-400">
                <TrendingUp className="h-4 w-4" />
                Notable NPCs (Priority)
              </h4>
              <div className="flex flex-wrap gap-2">
                {intel.notableNpcs.map((npc, index) => (
                  <Badge key={index} variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20">
                    {npc}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Loot & Escalation */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-green-400">
                  <Info className="h-4 w-4" />
                  Loot Potential
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {intel.loot}
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-purple-400">
                  <TrendingUp className="h-4 w-4" />
                  Escalation
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {intel.escalation}
                </p>
              </div>
            </div>

            {/* Pro Tips */}
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
              <h4 className="text-sm font-semibold mb-2 text-primary flex items-center gap-2">
                <Info className="h-4 w-4" />
                Pro Hunter Tips
              </h4>
              <p className="text-sm text-muted-foreground italic">
                &quot;{intel.tips}&quot;
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
