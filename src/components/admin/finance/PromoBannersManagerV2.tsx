'use client'

import { useState } from 'react'
import { useAdminPromoBanners, useCreatePromoBanner, useDeletePromoBanner } from '@/lib/admin/hooks/useAdminPromoBanners'
import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Image as ImageIcon, Plus, Trash2, X } from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'

export function PromoBannersManagerV2() {
  const { data: banners, isLoading } = useAdminPromoBanners()
  const deleteMutation = useDeletePromoBanner()
  const createMutation = useCreatePromoBanner()
  const [showCreate, setShowCreate] = useState(false)
  const [newBanner, setNewBanner] = useState({ title: '', description: '', imageUrl: '', link: '' })

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('Banner deleted')
    } catch {
      toast.error('Failed to delete')
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
      <div className="grid gap-4 md:grid-cols-2">
        {[1,2,3].map(i => (
          <div key={i} className="h-48 bg-eve-panel/60 animate-pulse rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          className="bg-eve-accent/20 text-eve-accent"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Banner
        </Button>
      </div>
      {!banners || banners.length === 0 ? (
        <AdminEmptyState icon={ImageIcon} title="No Promo Banners" description="Create promotional banners for the dashboard." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {banners.map((item) => (
            <Card key={item.id} className="bg-eve-panel/60 border-eve-border/30 overflow-hidden">
              <div className="h-32 bg-eve-dark relative">
                <Image src={item.imageUrl || ''} alt={item.title || 'Banner'} fill className="object-cover" unoptimized />
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-2 right-2"
                  onClick={() => handleDelete(item.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <CardContent className="p-4">
                <p className="text-sm text-eve-text/60">{item.description || 'No description'}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-eve-panel border border-eve-border/30 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-eve-text">New Banner</h3>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-eve-text/40">Title</label>
                <Input
                  value={newBanner.title}
                  onChange={(e) => setNewBanner({ ...newBanner, title: e.target.value })}
                  className="mt-1 bg-eve-background/50 border-eve-border/30"
                />
              </div>
              <div>
                <label className="text-xs text-eve-text/40">Description</label>
                <Input
                  value={newBanner.description}
                  onChange={(e) => setNewBanner({ ...newBanner, description: e.target.value })}
                  className="mt-1 bg-eve-background/50 border-eve-border/30"
                />
              </div>
              <div>
                <label className="text-xs text-eve-text/40">Image URL</label>
                <Input
                  value={newBanner.imageUrl}
                  onChange={(e) => setNewBanner({ ...newBanner, imageUrl: e.target.value })}
                  className="mt-1 bg-eve-background/50 border-eve-border/30"
                />
              </div>
              <div>
                <label className="text-xs text-eve-text/40">Link (optional)</label>
                <Input
                  value={newBanner.link}
                  onChange={(e) => setNewBanner({ ...newBanner, link: e.target.value })}
                  className="mt-1 bg-eve-background/50 border-eve-border/30"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={createMutation.isPending || !newBanner.title}
                className="bg-eve-accent/20 text-eve-accent"
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
