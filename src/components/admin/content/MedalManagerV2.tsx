'use client'

import { useState } from 'react'
import { useAdminMedals, useDeleteMedal, useCreateMedal, useUpdateMedal, useToggleMedal } from '@/lib/admin/hooks/useAdminMedals'
import type { Medal } from '@/lib/admin/hooks/useAdminMedals'
import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { 
  Medal as MedalIcon, 
  Plus, 
  Trash2, 
  Save, 
  AlertTriangle, 
  Users, 
  BarChart3, 
  Settings2,
  Database,
  Hash,
  Info,
  Loader2
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const INITIAL_NEW_MEDAL = {
  name: '',
  description: '',
  tier: 'bronze',
  icon: '🎖️',
  type: 'instant',
  criteria: '{}',
  isActive: true,
}

export function MedalManagerV2() {
  const { data, isLoading } = useAdminMedals(true)
  const deleteMutation = useDeleteMedal()
  const createMutation = useCreateMedal()
  const updateMutation = useUpdateMedal()
  const toggleMutation = useToggleMedal()
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [editMedal, setEditMedal] = useState<Medal | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newMedal, setNewMedal] = useState({ ...INITIAL_NEW_MEDAL })

  const medals = data?.medals || []
  
  const handleEdit = (medal: Medal) => {
    setEditMedal(medal)
    setNewMedal({ 
      name: medal.name, 
      description: medal.description, 
      tier: medal.tier,
      icon: medal.icon || '🎖️',
      type: medal.type || 'instant',
      criteria: medal.criteria || '{}',
      isActive: medal.isActive
    })
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'gold': return 'text-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]'
      case 'silver': return 'text-zinc-300 shadow-[0_0_10px_rgba(212,212,216,0.3)]'
      case 'bronze': return 'text-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]'
      default: return 'text-muted-foreground'
    }
  }
  
  const handleUpdate = async () => {
    if (!editMedal) return
    try {
      await updateMutation.mutateAsync({
        id: editMedal.id,
        ...newMedal
      })
      toast.success('Medal updated')
      setEditMedal(null)
      setNewMedal({ ...INITIAL_NEW_MEDAL })
    } catch {
      toast.error('Failed to update medal')
    }
  }

  const handleCreate = async () => {
    if (!newMedal.name) return
    try {
      await createMutation.mutateAsync(newMedal)
      toast.success('Medal created')
      setIsCreateDialogOpen(false)
      setNewMedal({ ...INITIAL_NEW_MEDAL })
    } catch {
      toast.error('Failed to create medal')
    }
  }

  const handleDelete = async (medalId: string) => {
    try {
      await deleteMutation.mutateAsync(medalId)
      toast.success('Medal deleted')
      setDeleteConfirmId(null)
    } catch {
      toast.error('Failed to delete medal')
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-3">
        {[1,2,3].map(i => (
          <div key={i} className="h-56 bg-card/20 backdrop-blur-xl animate-pulse border border-border/40 rounded-3xl" />
        ))}
      </div>
    )
  }

  if (medals.length === 0) {
    return <AdminEmptyState icon={MedalIcon} title="No medals found" description="Define achievements for your pilots." />
  }

  return (
    <div className="space-y-8 font-sans animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end border-b border-border/40 pb-6">
        <div className="flex items-center gap-5">
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl shadow-[0_0_20px_rgba(var(--primary),0.1)]">
            <MedalIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-black text-foreground tracking-tighter uppercase italic">Achievement Registry</h2>
            <p className="text-xs text-muted-foreground font-medium tracking-wide">Total Protocol Medals: {medals.length}</p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditMedal(null)
            setNewMedal({ ...INITIAL_NEW_MEDAL })
            setDeleteConfirmId(null)
            setIsCreateDialogOpen(true)
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-11 px-6 text-xs font-black uppercase tracking-[0.1em] shadow-[0_4px_15px_rgba(var(--primary),0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 mr-2.5" />
          Forge New Medal
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {medals.map((medal: Medal) => (
          <div 
            key={medal.id} 
            className={cn(
              "group relative bg-card/20 backdrop-blur-xl border border-border/40 rounded-3xl overflow-hidden transition-all duration-500 hover:border-primary/40 hover:shadow-2xl hover:-translate-y-1",
              !medal.isActive && "opacity-60 grayscale-[0.5]"
            )}
          >
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
            
            <div className="p-6 space-y-6 relative z-10">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 flex items-center justify-center bg-background/40 border border-border/40 rounded-2xl text-3xl shadow-inner group-hover:scale-110 transition-transform duration-500">
                    {medal.icon || '🎖️'}
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-foreground uppercase tracking-[0.1em]">{medal.name}</h3>
                    <div className={cn("text-[9px] uppercase tracking-[0.25em] font-black mt-1.5 px-2 py-0.5 bg-background/40 rounded-full border border-border/20 inline-block", getTierColor(medal.tier))}>
                      {medal.tier}_RANK
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEdit(medal)}
                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg border border-transparent hover:border-primary/20"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeleteConfirmId(medal.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg border border-transparent hover:border-destructive/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="min-h-[44px]">
                <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2 italic font-medium tracking-tight">
                  {medal.description || "Achievement metrics not defined."}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-background/40 border border-border/20 p-3 rounded-2xl shadow-inner">
                  <span className="text-[9px] text-muted-foreground/60 uppercase font-black tracking-widest block mb-1.5">Deployments</span>
                  <div className="flex items-center gap-2 text-foreground font-black tracking-tighter">
                    <BarChart3 className="w-3.5 h-3.5 text-primary/60" />
                    <span className="text-sm">{medal.awardCount || 0}</span>
                  </div>
                </div>
                <div className="bg-background/40 border border-border/20 p-3 rounded-2xl shadow-inner">
                  <span className="text-[9px] text-muted-foreground/60 uppercase font-black tracking-widest block mb-1.5">Pilots</span>
                  <div className="flex items-center gap-2 text-foreground font-black tracking-tighter">
                    <Users className="w-3.5 h-3.5 text-primary/60" />
                    <span className="text-sm">{medal.uniqueRecipients || 0}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-border/20">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-2 h-2 rounded-full ring-4 transition-all duration-500",
                    medal.isActive 
                      ? "bg-emerald-500 ring-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.4)]" 
                      : "bg-muted-foreground/30 ring-muted-foreground/5"
                  )} />
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-[0.15em]",
                    medal.isActive ? "text-emerald-500" : "text-muted-foreground/40"
                  )}>
                    {medal.isActive ? 'OPERATIONAL' : 'OFFLINE'}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-muted-foreground/40 uppercase font-black tracking-widest italic">{medal.type}</span>
                  <Switch 
                    checked={medal.isActive}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: medal.id, isActive: checked })}
                    disabled={toggleMutation.isPending}
                    className="scale-90 data-[state=checked]:bg-primary"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CREATE DIALOG */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="bg-background/60 backdrop-blur-3xl border-border/40 text-foreground sm:max-w-md rounded-3xl font-sans shadow-2xl p-0 overflow-hidden border-2">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          
          <DialogHeader className="p-8 pb-6 border-b border-border/40 relative bg-muted/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full pointer-events-none" />
            <div className="flex items-center gap-4 mb-3">
              <div className="p-2 bg-primary/10 border border-primary/20 rounded-xl">
                <Plus className="w-4 h-4 text-primary" />
              </div>
              <DialogTitle className="text-xl font-black tracking-tighter uppercase italic">
                Forge Achievement
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground font-medium tracking-wide ml-10">
              Initialize Achievement metrics for platform pilot rewards.
            </DialogDescription>
          </DialogHeader>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3 space-y-2">
                <Label htmlFor="name" className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Medal Designation</Label>
                <Input
                  id="name"
                  value={newMedal.name}
                  onChange={(e) => setNewMedal({ ...newMedal, name: e.target.value })}
                  className="bg-muted/30 border-border/40 rounded-2xl text-sm h-11 focus-visible:ring-primary/40 transition-all font-bold tracking-tight"
                  placeholder="e.g. Master Miner"
                />
              </div>
              <div className="space-y-2 text-center">
                <Label htmlFor="icon" className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Icon</Label>
                <Input
                  id="icon"
                  value={newMedal.icon}
                  onChange={(e) => setNewMedal({ ...newMedal, icon: e.target.value })}
                  className="bg-muted/30 border-border/40 rounded-2xl text-center text-xl h-11 focus-visible:ring-primary/40 transition-all shadow-inner"
                  placeholder="🎖️"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description" className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Historical Context</Label>
              <Input
                id="description"
                value={newMedal.description}
                onChange={(e) => setNewMedal({ ...newMedal, description: e.target.value })}
                className="bg-muted/30 border-border/40 rounded-2xl text-sm h-11 focus-visible:ring-primary/40 transition-all font-bold tracking-tight italic"
                placeholder="Description of the merit..."
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Medal Tier</Label>
                <Select
                  value={newMedal.tier}
                  onValueChange={(value) => setNewMedal({ ...newMedal, tier: value })}
                >
                  <SelectTrigger className="bg-muted/30 border-border/40 rounded-2xl h-11 text-xs font-bold focus:ring-primary/40 transition-all px-4">
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent className="bg-background/95 backdrop-blur-xl border-border/40 rounded-2xl shadow-2xl">
                    <SelectItem value="bronze" className="text-xs font-bold focus:bg-primary/10 focus:text-primary py-2.5 rounded-lg">Bronze Rank</SelectItem>
                    <SelectItem value="silver" className="text-xs font-bold focus:bg-primary/10 focus:text-primary py-2.5 rounded-lg">Silver Rank</SelectItem>
                    <SelectItem value="gold" className="text-xs font-bold focus:bg-primary/10 focus:text-primary py-2.5 rounded-lg">Gold Rank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Grant Type</Label>
                <Select
                  value={newMedal.type}
                  onValueChange={(value) => setNewMedal({ ...newMedal, type: value })}
                >
                  <SelectTrigger className="bg-muted/30 border-border/40 rounded-2xl h-11 text-xs font-bold focus:ring-primary/40 transition-all px-4">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-background/95 backdrop-blur-xl border-border/40 rounded-2xl shadow-2xl">
                    <SelectItem value="instant" className="text-xs font-bold focus:bg-primary/10 focus:text-primary py-2.5 rounded-lg">Instant Grant</SelectItem>
                    <SelectItem value="periodic" className="text-xs font-bold focus:bg-primary/10 focus:text-primary py-2.5 rounded-lg">Periodic Check</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="criteria" className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Protocol Criteria (JSON)</Label>
              <Textarea
                id="criteria"
                value={newMedal.criteria}
                onChange={(e) => setNewMedal({ ...newMedal, criteria: e.target.value })}
                className="bg-muted/30 border-border/40 rounded-2xl text-xs min-h-[120px] font-mono tracking-tight focus-visible:ring-primary/40 transition-all resize-none p-4 shadow-inner"
                placeholder='{ "minActivity": 10 }'
              />
            </div>
          </div>

          <DialogFooter className="p-8 bg-muted/20 border-t border-border/40 gap-4">
            <Button 
              variant="ghost" 
              onClick={() => setIsCreateDialogOpen(false)} 
              className="text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-xl text-xs font-black uppercase tracking-widest transition-all px-6"
            >
              Abort
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !newMedal.name}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-black uppercase tracking-[0.15em] px-10 h-11 shadow-[0_4px_15px_rgba(var(--primary),0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Forge Medal"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT DIALOG */}
      <Dialog open={!!editMedal} onOpenChange={(open) => !open && setEditMedal(null)}>
        <DialogContent className="bg-background/60 backdrop-blur-3xl border-border/40 text-foreground sm:max-w-md rounded-3xl font-sans shadow-2xl p-0 overflow-hidden border-2">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          
          <DialogHeader className="p-8 pb-6 border-b border-border/40 relative bg-muted/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full pointer-events-none" />
            <div className="flex items-center gap-4 mb-3">
              <div className="p-2 bg-primary/10 border border-primary/20 rounded-xl">
                <Settings2 className="w-4 h-4 text-primary" />
              </div>
              <DialogTitle className="text-xl font-black tracking-tighter uppercase italic">
                Adjust Parameters
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground font-medium tracking-wide ml-10">
              Modifying protocol parameters for {editMedal?.id.slice(0, 8)}
            </DialogDescription>
          </DialogHeader>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3 space-y-2">
                <Label htmlFor="edit-name" className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Medal Designation</Label>
                <Input
                  id="edit-name"
                  value={newMedal.name}
                  onChange={(e) => setNewMedal({ ...newMedal, name: e.target.value })}
                  className="bg-muted/30 border-border/40 rounded-2xl text-sm h-11 focus-visible:ring-primary/40 transition-all font-bold tracking-tight"
                />
              </div>
              <div className="space-y-2 text-center">
                <Label htmlFor="edit-icon" className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Icon</Label>
                <Input
                  id="edit-icon"
                  value={newMedal.icon}
                  onChange={(e) => setNewMedal({ ...newMedal, icon: e.target.value })}
                  className="bg-muted/30 border-border/40 rounded-2xl text-center text-xl h-11 focus-visible:ring-primary/40 transition-all shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description" className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Historical Context</Label>
              <Input
                id="edit-description"
                value={newMedal.description}
                onChange={(e) => setNewMedal({ ...newMedal, description: e.target.value })}
                className="bg-muted/30 border-border/40 rounded-2xl text-sm h-11 focus-visible:ring-primary/40 transition-all font-bold tracking-tight italic"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Medal Tier</Label>
                <Select
                  value={newMedal.tier}
                  onValueChange={(value) => setNewMedal({ ...newMedal, tier: value })}
                >
                  <SelectTrigger className="bg-muted/30 border-border/40 rounded-2xl h-11 text-xs font-bold focus:ring-primary/40 transition-all px-4">
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent className="bg-background/95 backdrop-blur-xl border-border/40 rounded-2xl shadow-2xl">
                    <SelectItem value="bronze" className="text-xs font-bold focus:bg-primary/10 focus:text-primary py-2.5 rounded-lg">Bronze Rank</SelectItem>
                    <SelectItem value="silver" className="text-xs font-bold focus:bg-primary/10 focus:text-primary py-2.5 rounded-lg">Silver Rank</SelectItem>
                    <SelectItem value="gold" className="text-xs font-bold focus:bg-primary/10 focus:text-primary py-2.5 rounded-lg">Gold Rank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Grant Type</Label>
                <Select
                  value={newMedal.type}
                  onValueChange={(value) => setNewMedal({ ...newMedal, type: value })}
                >
                  <SelectTrigger className="bg-muted/30 border-border/40 rounded-2xl h-11 text-xs font-bold focus:ring-primary/40 transition-all px-4">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-background/95 backdrop-blur-xl border-border/40 rounded-2xl shadow-2xl">
                    <SelectItem value="instant" className="text-xs font-bold focus:bg-primary/10 focus:text-primary py-2.5 rounded-lg">Instant Grant</SelectItem>
                    <SelectItem value="periodic" className="text-xs font-bold focus:bg-primary/10 focus:text-primary py-2.5 rounded-lg">Periodic Check</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-criteria" className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Protocol Criteria (JSON)</Label>
              <Textarea
                id="edit-criteria"
                value={newMedal.criteria}
                onChange={(e) => setNewMedal({ ...newMedal, criteria: e.target.value })}
                className="bg-muted/30 border-border/40 rounded-2xl text-xs min-h-[120px] font-mono tracking-tight focus-visible:ring-primary/40 transition-all resize-none p-4 shadow-inner"
              />
            </div>
            
            <div className="flex items-center gap-4 bg-muted/20 border border-border/20 rounded-2xl p-4 shadow-inner group">
              <Switch
                id="edit-active"
                checked={newMedal.isActive}
                onCheckedChange={(checked) => setNewMedal({ ...newMedal, isActive: checked })}
                className="data-[state=checked]:bg-primary"
              />
              <div className="flex flex-col">
                <Label htmlFor="edit-active" className="text-[10px] font-black text-foreground uppercase tracking-[0.1em] cursor-pointer group-hover:text-primary transition-colors">
                  Operational Status
                </Label>
                <span className="text-[9px] text-muted-foreground font-medium italic">Current medal visibility in platform registry</span>
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 bg-muted/20 border-t border-border/40 gap-4">
            <Button 
              variant="ghost" 
              onClick={() => setEditMedal(null)} 
              className="text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-xl text-xs font-black uppercase tracking-widest transition-all px-6"
            >
              Abort
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending || !newMedal.name}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-black uppercase tracking-[0.15em] px-10 h-11 shadow-[0_4px_15px_rgba(var(--primary),0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Commit Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRM */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="bg-background/60 backdrop-blur-3xl border-destructive/40 text-foreground sm:max-w-md rounded-3xl font-sans shadow-2xl p-0 overflow-hidden border-2 animate-in zoom-in-95">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-destructive/40 to-transparent" />
          
          <DialogHeader className="p-8 pb-6 border-b border-destructive/20 relative bg-destructive/5">
            <div className="flex items-center gap-4 mb-3">
              <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <DialogTitle className="text-xl font-black tracking-tighter uppercase italic text-destructive">
                Decommission Medal
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-destructive/60 font-medium tracking-wide ml-10">
              Irreversible protocol action detected.
            </DialogDescription>
          </DialogHeader>

          <div className="p-8">
            <div className="bg-destructive/5 border border-destructive/10 p-5 space-y-4 rounded-2xl shadow-inner">
              <div className="flex items-center gap-3">
                <Info className="w-4 h-4 text-destructive" />
                <span className="text-[10px] text-destructive font-black uppercase tracking-[0.2em]">Data Erasure Warning</span>
              </div>
              <p className="text-xs text-destructive/80 leading-relaxed font-medium italic">
                Deleting this achievement will purge it from all pilot profiles permanently. Historical records will be erased from the centralized database.
              </p>
            </div>
          </div>

          <DialogFooter className="p-8 bg-destructive/5 border-t border-destructive/20 gap-4">
            <Button 
              variant="ghost" 
              onClick={() => setDeleteConfirmId(null)} 
              className="text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-xl text-xs font-black uppercase tracking-widest transition-all px-6"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl text-xs font-black uppercase tracking-[0.15em] px-10 h-11 shadow-[0_4px_15px_rgba(239,68,68,0.3)] transition-all"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Execute Purge"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
