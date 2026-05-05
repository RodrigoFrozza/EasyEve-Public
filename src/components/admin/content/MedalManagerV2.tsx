'use client'

import { useState } from 'react'
import { useAdminMedals, useDeleteMedal, useCreateMedal, useUpdateMedal, useToggleMedal } from '@/lib/admin/hooks/useAdminMedals'
import type { Medal } from '@/lib/admin/hooks/useAdminMedals'
import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Medal as MedalIcon, Plus, Trash2, Save, X, AlertTriangle, Users, BarChart3, Settings2 } from 'lucide-react'
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
      case 'gold': return 'text-yellow-400'
      case 'silver': return 'text-slate-300'
      case 'bronze': return 'text-amber-600'
      default: return 'text-eve-accent'
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
      <div className="grid gap-4 md:grid-cols-3">
        {[1,2,3].map(i => (
          <div key={i} className="h-40 bg-eve-panel/60 animate-pulse rounded-lg" />
        ))}
      </div>
    )
  }

  if (medals.length === 0) {
    return <AdminEmptyState icon={MedalIcon} title="No Medals" description="Create medals to award users." />
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditMedal(null)
            setNewMedal({ ...INITIAL_NEW_MEDAL })
            setDeleteConfirmId(null)
            // Trigger dialog via a separate state if needed, but here I'll use editMedal state trick or dedicated create state
            setIsCreateDialogOpen(true)
          }}
          className="bg-eve-accent text-black hover:bg-eve-accent/80 font-bold"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Medal
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {medals.map((medal: Medal) => (
          <Card key={medal.id} className={cn(
            "bg-eve-panel/60 border-eve-border/30 transition-all hover:border-eve-accent/30",
            !medal.isActive && "opacity-60"
          )}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{medal.icon || '🎖️'}</span>
                  <div className="flex flex-col">
                    <span className="font-bold">{medal.name}</span>
                    <span className={cn("text-[10px] uppercase tracking-wider font-black", getTierColor(medal.tier))}>
                      {medal.tier}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEdit(medal)}
                    className="h-8 w-8 text-eve-accent hover:text-eve-accent/80"
                    title="Edit medal"
                  >
                    <Settings2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeleteConfirmId(medal.id)}
                    className="h-8 w-8 text-red-400 hover:text-red-300"
                    title="Delete medal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <p className="text-sm text-eve-text/60 line-clamp-2 min-h-[40px]">{medal.description}</p>
              
              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-eve-border/20">
                <div className="flex flex-col">
                  <span className="text-[10px] text-eve-text/30 uppercase font-bold">Total Awards</span>
                  <div className="flex items-center gap-1.5 text-eve-text/80">
                    <BarChart3 className="w-3 h-3 text-eve-accent" />
                    <span className="text-sm font-mono">{medal.awardCount || 0}</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-eve-text/30 uppercase font-bold">Recipients</span>
                  <div className="flex items-center gap-1.5 text-eve-text/80">
                    <Users className="w-3 h-3 text-blue-400" />
                    <span className="text-sm font-mono">{medal.uniqueRecipients || 0}</span>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-0 flex justify-between items-center">
              <span className={cn(
                "text-[10px] uppercase font-black px-2 py-0.5 rounded-full",
                medal.type === 'instant' ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"
              )}>
                {medal.type}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-eve-text/40 uppercase font-bold">Active</span>
                <Switch 
                  checked={medal.isActive}
                  onCheckedChange={(checked) => toggleMutation.mutate({ id: medal.id, isActive: checked })}
                  disabled={toggleMutation.isPending}
                />
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="bg-eve-panel border-eve-border text-eve-text sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MedalIcon className="w-5 h-5 text-eve-accent" />
              Create New Medal
            </DialogTitle>
            <DialogDescription className="text-eve-text/60">
              Define a new medal that can be awarded to users.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3 grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newMedal.name}
                  onChange={(e) => setNewMedal({ ...newMedal, name: e.target.value })}
                  className="bg-eve-background/50 border-eve-border/30"
                  placeholder="Medal name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="icon">Icon</Label>
                <Input
                  id="icon"
                  value={newMedal.icon}
                  onChange={(e) => setNewMedal({ ...newMedal, icon: e.target.value })}
                  className="bg-eve-background/50 border-eve-border/30 text-center text-lg"
                  placeholder="🎖️"
                />
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={newMedal.description}
                onChange={(e) => setNewMedal({ ...newMedal, description: e.target.value })}
                className="bg-eve-background/50 border-eve-border/30"
                placeholder="What is this medal for?"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tier</Label>
                <Select
                  value={newMedal.tier}
                  onValueChange={(value) => setNewMedal({ ...newMedal, tier: value })}
                >
                  <SelectTrigger className="bg-eve-background/50 border-eve-border/30">
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent className="bg-eve-panel border-eve-border">
                    <SelectItem value="bronze">Bronze</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={newMedal.type}
                  onValueChange={(value) => setNewMedal({ ...newMedal, type: value })}
                >
                  <SelectTrigger className="bg-eve-background/50 border-eve-border/30">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-eve-panel border-eve-border">
                    <SelectItem value="instant">Instant Award</SelectItem>
                    <SelectItem value="periodic">Periodic Goal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="criteria">Award Criteria (JSON)</Label>
              <Textarea
                id="criteria"
                value={newMedal.criteria}
                onChange={(e) => setNewMedal({ ...newMedal, criteria: e.target.value })}
                className="bg-eve-background/50 border-eve-border/30 font-mono text-xs min-h-[100px]"
                placeholder='{ "minActivity": 10 }'
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="border-eve-border/30">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !newMedal.name}
              className="bg-eve-accent text-black hover:bg-eve-accent/80 font-bold gap-2"
            >
              {createMutation.isPending ? (
                <div className="h-4 w-4 border-2 border-black/20 border-t-black animate-spin rounded-full" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Create Medal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editMedal} onOpenChange={(open) => !open && setEditMedal(null)}>
        <DialogContent className="bg-eve-panel border-eve-border text-eve-text sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MedalIcon className="w-5 h-5 text-eve-accent" />
              Edit Medal
            </DialogTitle>
            <DialogDescription className="text-eve-text/60">
              Update the details for this medal.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3 grid gap-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={newMedal.name}
                  onChange={(e) => setNewMedal({ ...newMedal, name: e.target.value })}
                  className="bg-eve-background/50 border-eve-border/30"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-icon">Icon</Label>
                <Input
                  id="edit-icon"
                  value={newMedal.icon}
                  onChange={(e) => setNewMedal({ ...newMedal, icon: e.target.value })}
                  className="bg-eve-background/50 border-eve-border/30 text-center text-lg"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={newMedal.description}
                onChange={(e) => setNewMedal({ ...newMedal, description: e.target.value })}
                className="bg-eve-background/50 border-eve-border/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tier</Label>
                <Select
                  value={newMedal.tier}
                  onValueChange={(value) => setNewMedal({ ...newMedal, tier: value })}
                >
                  <SelectTrigger className="bg-eve-background/50 border-eve-border/30">
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent className="bg-eve-panel border-eve-border">
                    <SelectItem value="bronze">Bronze</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={newMedal.type}
                  onValueChange={(value) => setNewMedal({ ...newMedal, type: value })}
                >
                  <SelectTrigger className="bg-eve-background/50 border-eve-border/30">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-eve-panel border-eve-border">
                    <SelectItem value="instant">Instant Award</SelectItem>
                    <SelectItem value="periodic">Periodic Goal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-criteria">Award Criteria (JSON)</Label>
              <Textarea
                id="edit-criteria"
                value={newMedal.criteria}
                onChange={(e) => setNewMedal({ ...newMedal, criteria: e.target.value })}
                className="bg-eve-background/50 border-eve-border/30 font-mono text-xs min-h-[100px]"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                id="edit-active"
                checked={newMedal.isActive}
                onCheckedChange={(checked) => setNewMedal({ ...newMedal, isActive: checked })}
              />
              <Label htmlFor="edit-active">Active (available for awarding)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMedal(null)} className="border-eve-border/30">
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending || !newMedal.name}
              className="bg-eve-accent text-black hover:bg-eve-accent/80 font-bold gap-2"
            >
              {updateMutation.isPending ? (
                <div className="h-4 w-4 border-2 border-black/20 border-t-black animate-spin rounded-full" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="bg-eve-panel border-eve-border text-eve-text sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Delete Medal
            </DialogTitle>
            <DialogDescription className="text-eve-text/60">
              Are you sure you want to delete this medal? This action cannot be undone and may affect users who have already received it.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="border-eve-border/30">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleteMutation.isPending}
              className="font-bold gap-2"
            >
              {deleteMutation.isPending ? (
                <div className="h-4 w-4 border-2 border-white/20 border-t-white animate-spin rounded-full" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
