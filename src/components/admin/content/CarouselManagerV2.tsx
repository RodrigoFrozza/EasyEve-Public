'use client'

import { useState } from 'react'
import {
  useAdminCarousel,
  useCreateCarouselItem,
  useDeleteCarouselItem,
} from '@/lib/admin/hooks/useAdminCarousel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Image as ImageIcon, Plus, Trash2, Link as LinkIcon } from 'lucide-react'
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
import { useTranslations } from '@/i18n/hooks'
import { Skeleton } from '@/components/ui/skeleton'

export function CarouselManagerV2() {
  const { t } = useTranslations()
  const { data: items, isLoading } = useAdminCarousel()
  const deleteMutation = useDeleteCarouselItem()
  const createMutation = useCreateCarouselItem()
  const [showCreate, setShowCreate] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [newSlide, setNewSlide] = useState({ imageUrl: '', altText: '', link: '' })

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id)
      toast.success(t('admin.carousel.deleted'))
      setShowDeleteConfirm(null)
    } catch {
      toast.error(t('admin.deleteError'))
    }
  }

  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync(newSlide)
      toast.success(t('admin.carousel.created'))
      setShowCreate(false)
      setNewSlide({ imageUrl: '', altText: '', link: '' })
    } catch {
      toast.error(t('admin.errorPrefix'))
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-56 rounded-lg" />
        ))}
      </div>
    )
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
        <ImageIcon className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground mb-4">{t('admin.carousel.empty')}</p>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('admin.carousel.add')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t('admin.carousel.count', { count: items.length })}
        </p>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('admin.carousel.add')}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="group rounded-lg border border-border bg-card overflow-hidden"
          >
            <div className="relative h-40 bg-muted">
              <Image
                src={item.imageUrl}
                alt={item.altText || 'Carousel'}
                fill
                className="object-cover"
                unoptimized
              />
              <Button
                size="icon"
                variant="destructive"
                className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setShowDeleteConfirm(item.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-sm font-medium line-clamp-2">
                {item.altText || t('admin.carousel.noDescription')}
              </p>
              {item.link && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                  <LinkIcon className="h-3 w-3 shrink-0" />
                  {item.link}
                </p>
              )}
              <p className="text-xs text-muted-foreground font-mono truncate">{item.id}</p>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.carousel.add')}</DialogTitle>
            <DialogDescription>{t('admin.carousel.addDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('admin.carousel.imageUrl')}</Label>
              <Input
                value={newSlide.imageUrl}
                onChange={(e) => setNewSlide({ ...newSlide, imageUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.newsImage')}</Label>
              <Input
                value={newSlide.altText}
                onChange={(e) => setNewSlide({ ...newSlide, altText: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.carousel.link')}</Label>
              <Input
                value={newSlide.link}
                onChange={(e) => setNewSlide({ ...newSlide, link: e.target.value })}
                placeholder="/dashboard"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              {t('admin.cancel')}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !newSlide.imageUrl}
            >
              {t('admin.publishNews')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showDeleteConfirm} onOpenChange={(o) => !o && setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.confirmDelete')}</DialogTitle>
            <DialogDescription>{t('admin.carousel.deleteConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
              {t('admin.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
              disabled={deleteMutation.isPending}
            >
              {t('admin.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
