'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Loader2, Save } from 'lucide-react'
import {
  useAdminNews,
  useCreateNews,
  useUpdateNews,
  useDeleteNews,
  type NewsItem,
} from '@/lib/admin/hooks/useAdminNews'
import { AdminDataTable } from '@/components/admin/shared/AdminDataTable'
import { AdminBadge } from '@/components/admin/shared/AdminBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { useTranslations } from '@/i18n/hooks'
import { Skeleton } from '@/components/ui/skeleton'

export function NewsManagerV2() {
  const { t } = useTranslations()
  const { data: news, isLoading } = useAdminNews()
  const createNews = useCreateNews()
  const updateNews = useUpdateNews()
  const deleteNews = useDeleteNews()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingNews, setEditingNews] = useState<Partial<NewsItem> | null>(null)

  const handleOpenDialog = (item?: NewsItem) => {
    setEditingNews(
      item ?? {
        title: '',
        content: '',
        imageUrl: '',
        category: 'news',
        published: true,
      }
    )
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!editingNews?.title || !editingNews?.content) {
      toast.error(t('admin.news.requiredFields'))
      return
    }
    try {
      if (editingNews.id) {
        await updateNews.mutateAsync(editingNews as NewsItem & { id: string })
        toast.success(t('admin.news.updated'))
      } else {
        await createNews.mutateAsync(editingNews)
        toast.success(t('admin.news.created'))
      }
      setIsDialogOpen(false)
    } catch {
      toast.error(t('admin.errorSaving'))
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('admin.news.deleteConfirm'))) return
    try {
      await deleteNews.mutateAsync(id)
      toast.success(t('admin.news.deleted'))
    } catch {
      toast.error(t('admin.deleteError'))
    }
  }

  const columns = [
    {
      key: 'title',
      header: t('admin.newsTitle'),
      render: (item: NewsItem) => (
        <div>
          <p className="text-sm font-medium">{item.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            <FormattedDate date={item.createdAt} />
          </p>
        </div>
      ),
    },
    {
      key: 'category',
      header: t('admin.newsCategory'),
      render: (item: NewsItem) => (
        <AdminBadge status={item.category === 'patch' ? 'info' : 'success'}>
          {item.category}
        </AdminBadge>
      ),
    },
    {
      key: 'published',
      header: t('admin.status'),
      render: (item: NewsItem) => (
        <AdminBadge status={item.published ? 'success' : 'warning'}>
          {item.published ? t('admin.filterActive') : t('admin.news.draft')}
        </AdminBadge>
      ),
    },
    {
      key: 'actions',
      header: t('admin.action'),
      className: 'text-right',
      render: (item: NewsItem) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleOpenDialog(item)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={() => handleDelete(item.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('admin.newNews')}
        </Button>
      </div>

      <AdminDataTable
        data={news || []}
        keyExtractor={(item) => item.id}
        columns={columns}
        emptyMessage={t('admin.noNews')}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingNews?.id ? t('admin.news.edit') : t('admin.newNews')}
            </DialogTitle>
            <DialogDescription>{t('admin.newsSubtitle')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="title">{t('admin.newsTitle')}</Label>
              <Input
                id="title"
                value={editingNews?.title || ''}
                onChange={(e) =>
                  setEditingNews((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('admin.newsCategory')}</Label>
                <Select
                  value={editingNews?.category || 'news'}
                  onValueChange={(value) =>
                    setEditingNews((prev) => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="news">news</SelectItem>
                    <SelectItem value="patch">patch</SelectItem>
                    <SelectItem value="forum">forum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  id="published"
                  checked={editingNews?.published ?? true}
                  onCheckedChange={(checked) =>
                    setEditingNews((prev) => ({ ...prev, published: checked }))
                  }
                />
                <Label htmlFor="published">{t('admin.news.published')}</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">{t('admin.newsImage')}</Label>
              <Input
                id="image"
                value={editingNews?.imageUrl || ''}
                onChange={(e) =>
                  setEditingNews((prev) => ({ ...prev, imageUrl: e.target.value }))
                }
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">{t('admin.newsContent')}</Label>
              <Textarea
                id="content"
                value={editingNews?.content || ''}
                onChange={(e) =>
                  setEditingNews((prev) => ({ ...prev, content: e.target.value }))
                }
                className="min-h-[200px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t('admin.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={createNews.isPending || updateNews.isPending}
              className="gap-2"
            >
              {(createNews.isPending || updateNews.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <Save className="h-4 w-4" />
              {t('admin.publishNews')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
