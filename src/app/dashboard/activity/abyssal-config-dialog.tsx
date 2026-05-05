'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useActivityStore } from '@/lib/stores/activity-store'
import { ABYSSAL_TIERS, ABYSSAL_WEATHER } from '@/lib/constants/activity-data'
import { Zap, Edit2, Settings2 } from 'lucide-react'

export function AbyssalConfigDialog({
  activityId,
  onClose,
}: {
  activityId: string | null
  onClose: () => void
}) {
  const { activities, updateActivity } = useActivityStore()
  const activity = activities.find((a) => a.id === activityId)
  const [tier, setTier] = useState(activity?.data?.tier || 'T0 (Tranquil)')
  const [weather, setWeather] = useState(activity?.data?.weather || 'Electrical')
  const [trackingMode, setTrackingMode] = useState(activity?.data?.trackingMode || 'automatic')

  useEffect(() => {
    if (activity) {
      setTier(activity.data?.tier || 'T0 (Tranquil)')
      setWeather(activity.data?.weather || 'Electrical')
      setTrackingMode(activity.data?.trackingMode || 'automatic')
    }
  }, [activity])

  const handleSave = async () => {
    if (!activityId || !activity) return

    const previousData = activity.data
    const updatedData = {
      ...activity.data,
      tier,
      weather,
      trackingMode,
    }

    updateActivity(activityId, { data: updatedData })
    try {
      const response = await fetch(`/api/activities/${activityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updatedData }),
      })
      if (!response.ok) {
        updateActivity(activityId, { data: previousData })
        const errBody = await response.json().catch(() => ({}))
        toast.error(errBody.error || 'Failed to update configuration')
        return
      }
      toast.success('Abyssal configuration updated')
      onClose()
    } catch {
      updateActivity(activityId, { data: previousData })
      toast.error('Failed to update configuration')
    }
  }

  return (
    <Dialog open={!!activityId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#050507] border-eve-border/30 text-white max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-eve-accent" />
            Abyssal Configuration
          </DialogTitle>
          <DialogDescription className="text-zinc-500 text-xs">
            Update your mission parameters in real-time. Changes affect future runs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">Filament Tier</Label>
            <Select value={tier} onValueChange={setTier}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800 focus:ring-eve-accent/20 h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                {ABYSSAL_TIERS.map((t) => (
                  <SelectItem key={t.label} value={t.label} className="text-xs uppercase font-mono">
                    <div className="flex items-center gap-2">
                      <img 
                        src={t.iconPath} 
                        alt="" 
                        className="w-4 h-4 rounded-sm"
                      />
                      {t.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">Weather Effect</Label>
            <Select value={weather} onValueChange={setWeather}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800 focus:ring-eve-accent/20 h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                {ABYSSAL_WEATHER.map((w) => (
                  <SelectItem key={w.label} value={w.label} className="text-xs uppercase font-mono">
                    <div className="flex items-center gap-2">
                      <img 
                        src={w.iconPath} 
                        alt="" 
                        className="w-4 h-4 rounded-sm"
                      />
                      {w.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">Tracking Mode</Label>
            <Select value={trackingMode} onValueChange={setTrackingMode}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800 text-eve-accent font-black focus:ring-eve-accent/20 h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="automatic" className="text-[10px] font-black uppercase tracking-widest">
                  <div className="flex items-center gap-2">
                    <Zap className="h-3 w-3 text-yellow-500" />
                    Automatic (ESI Tracking)
                  </div>
                </SelectItem>
                <SelectItem value="manual" className="text-[10px] font-black uppercase tracking-widest">
                  <div className="flex items-center gap-2">
                    <Edit2 className="h-3 w-3 text-blue-500" />
                    Manual (User Triggered)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="uppercase text-[10px] font-black tracking-widest text-zinc-500 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-eve-accent text-black hover:bg-eve-accent/80 font-black uppercase text-[10px] tracking-widest px-6 shadow-[0_0_20px_rgba(0,255,255,0.2)]"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
