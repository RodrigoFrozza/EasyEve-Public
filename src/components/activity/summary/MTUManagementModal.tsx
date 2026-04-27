'use client'

import { useState } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Box, Wallet } from 'lucide-react'
import { formatISK, formatNumber } from '@/lib/utils'
import { toast } from 'sonner'

interface MTU {
  name: string
  value: number
}

interface MTUManagementModalProps {
  activityId: string
  initialMtus: MTU[]
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSave: (mtus: MTU[]) => void
}

export function MTUManagementModal({ 
  activityId, 
  initialMtus, 
  isOpen, 
  onOpenChange, 
  onSave 
}: MTUManagementModalProps) {
  const [mtus, setMtus] = useState<MTU[]>(initialMtus || [])
  const [isSaving, setIsSaving] = useState(false)

  const addMtu = () => {
    setMtus([...mtus, { name: `MTU ${mtus.length + 1}`, value: 0 }])
  }

  const removeMtu = (index: number) => {
    setMtus(mtus.filter((_, i) => i !== index))
  }

  const updateMtu = (index: number, updates: Partial<MTU>) => {
    setMtus(mtus.map((m, i) => i === index ? { ...m, ...updates } : m))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/activities/${activityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data: { 
            mtuSummaries: mtus,
            // We also update a total value for the report
            estimatedLootValue: mtus.reduce((sum, m) => sum + (m.value || 0), 0)
          } 
        })
      })

      if (response.ok) {
        onSave(mtus)
        onOpenChange(false)
        toast.success('MTU data updated successfully')
      } else {
        throw new Error('Failed to update')
      }
    } catch (error) {
      console.error('Error updating MTUs:', error)
      toast.error('Failed to save MTU data')
    } finally {
      setIsSaving(false)
    }
  }

  const totalValue = mtus.reduce((sum, m) => sum + (Number(m.value) || 0), 0)

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#050507] border-white/10 sm:max-w-[425px] text-white p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="bg-zinc-900/50 p-6 border-b border-white/5">
          <DialogTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
            <Box className="h-5 w-5 text-blue-400" />
            MTU Loot Registry
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500 mt-1">
            Register and manage MTU loot from your activity sessions
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
          {mtus.length === 0 ? (
            <div className="text-center py-8 opacity-40">
              <p className="text-[10px] font-black uppercase tracking-widest italic">No MTUs registered for this session</p>
            </div>
          ) : (
            <div className="space-y-3">
              {mtus.map((mtu, index) => (
                <div key={index} className="flex flex-col gap-2 p-3 bg-white/5 rounded-xl border border-white/5 group">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-zinc-500">MTU Identification</Label>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeMtu(index)}
                      className="h-6 w-6 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input 
                      value={mtu.name}
                      onChange={(e) => updateMtu(index, { name: e.target.value })}
                      className="h-9 bg-black/40 border-white/5 text-xs font-bold"
                      placeholder="MTU Name"
                    />
                    <div className="relative">
                      <Wallet className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-green-500/50" />
                      <Input 
                        type="number"
                        value={mtu.value || ''}
                        onChange={(e) => updateMtu(index, { value: Number(e.target.value) })}
                        className="h-9 pl-7 bg-black/40 border-white/5 text-xs font-bold font-mono text-green-400"
                        placeholder="Total ISK"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button 
            variant="outline" 
            onClick={addMtu}
            className="w-full h-10 bg-white/5 border-dashed border-white/10 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-zinc-400"
          >
            <Plus className="h-3 w-3 mr-2" />
            Add New MTU Entry
          </Button>
        </div>

        <div className="bg-zinc-900/50 p-6 border-t border-white/5">
          <div className="flex items-center justify-between mb-4">
             <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Consolidated Loot</span>
             <span className="text-lg font-black font-mono text-green-400">{formatISK(totalValue)}</span>
          </div>
          <DialogFooter>
            <Button 
              disabled={isSaving}
              onClick={handleSave}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-[0.2em] h-12 rounded-xl shadow-lg shadow-blue-500/10"
            >
              Update Activity History
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
