'use client'

import { useState } from 'react'
import { useAdminPromoBanners, useCreatePromoBanner, useDeletePromoBanner } from '@/lib/admin/hooks/useAdminPromoBanners'
import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Image as ImageIcon, Plus, Trash2, X, Database, Layout, Shield, Loader2, Save } from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function PromoBannersManagerV2() {
  const { data: banners, isLoading } = useAdminPromoBanners()
  const deleteMutation = useDeletePromoBanner()
  const createMutation = useCreatePromoBanner()
  const [showCreate, setShowCreate] = useState(false)
  const [newBanner, setNewBanner] = useState({ title: '', description: '', imageUrl: '', link: '' })

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this banner?')) return
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('Banner deleted')
    } catch {
      toast.error('Failed to delete banner')
    }
  }

  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync(newBanner)
      toast.success('Banner created')
      setShowCreate(false)
      setNewBanner({ title: '', description: '', imageUrl: '', link: '' })
    } catch {
      toast.error('Failed to create banner')
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 font-mono">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-48 bg-zinc-950 border border-zinc-900 animate-pulse rounded-none" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-md">
            <Layout className="w-4 h-4 text-zinc-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-100">Promo Banners</h2>
            <p className="text-xs text-zinc-600">Dashboard Notifications</p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-zinc-100 text-black hover:bg-zinc-300 rounded-md h-9 px-4 text-xs font-semibold"
        >
          <Plus className="w-3.5 h-3.5 mr-2" />
          Create Banner
        </Button>
      </div>

      {!banners || banners.length === 0 ? (
        <AdminEmptyState icon={ImageIcon} title="No banners found" description="Create your first promo banner to display on the dashboard." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {banners.map((item) => (
            <div key={item.id} className="bg-zinc-950 border border-zinc-900 rounded-md overflow-hidden group relative">
              <div className="absolute top-0 left-0 w-[2px] h-full bg-zinc-800 group-hover:bg-zinc-500 transition-colors" />
              
              <div className="h-32 bg-zinc-900 relative">
                <Image src={item.imageUrl || ''} alt={item.title || 'Banner'} fill className="object-cover transition-all duration-500" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent opacity-60" />
                
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 bg-zinc-950/80 hover:bg-red-950/40 text-zinc-400 hover:text-red-500 rounded-md border border-zinc-800 hover:border-red-900/50"
                    onClick={() => handleDelete(item.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="absolute bottom-2 left-3 flex items-center gap-1.5 px-2 py-0.5 bg-zinc-950/80 border border-zinc-800 text-[8px] text-zinc-500 font-bold uppercase rounded-sm">
                  ID: {item.id.slice(0, 8)}
                </div>
              </div>

              <div className="p-4 space-y-2">
                <h3 className="text-xs font-bold text-zinc-100">{item.title || 'Untitled'}</h3>
                <p className="text-[10px] text-zinc-500 leading-relaxed line-clamp-2">
                  {item.description || 'No description provided'}
                </p>
                {item.link && (
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-500 bg-zinc-900/30 p-2 border border-zinc-900 rounded-md">
                    <Database className="w-3 h-3" />
                    <span>Link: {item.link}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-zinc-950 border border-zinc-800 text-zinc-100 sm:max-w-md rounded-md font-sans">
          <DialogHeader className="border-b border-zinc-900 pb-4">
            <DialogTitle className="text-sm font-bold">Create Promo Banner</DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Set the details for the new promotional banner.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-xs font-medium text-zinc-400">Title</Label>
              <Input
                id="title"
                value={newBanner.title}
                onChange={(e) => setNewBanner({ ...newBanner, title: e.target.value })}
                className="bg-zinc-900 border-zinc-800 rounded-md text-sm focus-visible:ring-zinc-700"
                placeholder="Banner title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-xs font-medium text-zinc-400">Description</Label>
              <Input
                id="description"
                value={newBanner.description}
                onChange={(e) => setNewBanner({ ...newBanner, description: e.target.value })}
                className="bg-zinc-900 border-zinc-800 rounded-md text-sm focus-visible:ring-zinc-700"
                placeholder="Brief description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imageUrl" className="text-xs font-medium text-zinc-400">Image URL</Label>
              <Input
                id="imageUrl"
                value={newBanner.imageUrl}
                onChange={(e) => setNewBanner({ ...newBanner, imageUrl: e.target.value })}
                className="bg-zinc-900 border-zinc-800 rounded-md text-sm focus-visible:ring-zinc-700"
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link" className="text-xs font-medium text-zinc-400">Target Link</Label>
              <Input
                id="link"
                value={newBanner.link}
                onChange={(e) => setNewBanner({ ...newBanner, link: e.target.value })}
                className="bg-zinc-900 border-zinc-800 rounded-md text-sm focus-visible:ring-zinc-700"
                placeholder="/dashboard/module"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-zinc-900 pt-4 gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowCreate(false)}
              className="text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900 rounded-md text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !newBanner.title}
              className="bg-zinc-100 text-black hover:bg-zinc-300 rounded-md text-xs font-bold px-8"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-2" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
