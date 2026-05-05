'use client'

import { useState } from 'react'
import { useAdminCarousel, useCreateCarouselItem, useDeleteCarouselItem } from '@/lib/admin/hooks/useAdminCarousel'
import { AdminEmptyState } from '@/components/admin/shared/AdminEmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Image as ImageIcon, Plus, Trash2, Save, X } from 'lucide-react'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export function CarouselManagerV2() {
  const { data: items, isLoading } = useAdminCarousel()
  const deleteMutation = useDeleteCarouselItem()
  const createMutation = useCreateCarouselItem()
  const [showCreate, setShowCreate] = useState(false)
  const [newSlide, setNewSlide] = useState({ imageUrl: '', altText: '', link: '' })

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('Item deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync(newSlide)
      toast.success('Slide added')
      setShowCreate(false)
      setNewSlide({ imageUrl: '', altText: '', link: '' })
    } catch {
      toast.error('Failed to create slide')
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

  if (!items || items.length === 0) {
    return <AdminEmptyState icon={ImageIcon} title="No Carousel Items" description="Add images to the homepage carousel." />
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
          Add Slide
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <Card key={item.id} className="bg-eve-panel/60 border-eve-border/30 overflow-hidden">
            <div className="h-32 bg-eve-dark relative">
              <Image src={item.imageUrl} alt={item.altText || 'Carousel item'} fill className="object-cover" unoptimized />
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
              <p className="text-sm text-eve-text/60">{item.altText || 'No description'}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-eve-panel border-eve-border text-eve-text sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-eve-accent" />
              Add New Slide
            </DialogTitle>
            <DialogDescription className="text-eve-text/60">
              Enter the details for the new homepage carousel slide.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="image-url" className="text-eve-text/60">Image URL</Label>
              <Input
                id="image-url"
                value={newSlide.imageUrl}
                onChange={(e) => setNewSlide({ ...newSlide, imageUrl: e.target.value })}
                className="bg-eve-background/50 border-eve-border/30"
                placeholder="https://..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="alt-text" className="text-eve-text/60">Alt Text</Label>
              <Input
                id="alt-text"
                value={newSlide.altText}
                onChange={(e) => setNewSlide({ ...newSlide, altText: e.target.value })}
                className="bg-eve-background/50 border-eve-border/30"
                placeholder="Brief description for accessibility"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="link" className="text-eve-text/60">Link (optional)</Label>
              <Input
                id="link"
                value={newSlide.link}
                onChange={(e) => setNewSlide({ ...newSlide, link: e.target.value })}
                className="bg-eve-background/50 border-eve-border/30"
                placeholder="/dashboard/fits"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreate(false)}
              className="border-eve-border/30"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !newSlide.imageUrl}
              className="bg-eve-accent text-black hover:bg-eve-accent/80 font-bold gap-2"
            >
              {createMutation.isPending ? (
                <div className="h-4 w-4 border-2 border-black/20 border-t-black animate-spin rounded-full" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Add Slide
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
