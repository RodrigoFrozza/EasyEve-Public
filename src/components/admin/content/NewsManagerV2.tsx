'use client'

import { useState } from 'react'
import { Newspaper, Plus, Pencil, Trash2, Loader2, Save, X, Megaphone, MessageSquare, Eye } from 'lucide-react'
import { useAdminNews, useCreateNews, useUpdateNews, useDeleteNews, NewsItem } from '@/lib/admin/hooks/useAdminNews'
import { AdminTable } from '@/components/admin/shared/AdminTable'
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
import Image from 'next/image'
import { cn } from '@/lib/utils'

export function NewsManagerV2() {
  const { data: news, isLoading } = useAdminNews()
  const createNews = useCreateNews()
  const updateNews = useUpdateNews()
  const deleteNews = useDeleteNews()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingNews, setEditingNews] = useState<Partial<NewsItem> | null>(null)

  const handleOpenDialog = (item?: NewsItem) => {
    if (item) {
      setEditingNews(item)
    } else {
      setEditingNews({
        title: '',
        content: '',
        imageUrl: '',
        category: 'news',
        published: true,
      })
    }
    setIsDialogOpen(true)
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'news': return <Megaphone className="w-4 h-4 text-eve-accent" />
      case 'patch': return <Newspaper className="w-4 h-4 text-blue-400" />
      case 'forum': return <MessageSquare className="w-4 h-4 text-purple-400" />
      default: return <Megaphone className="w-4 h-4" />
    }
  }

  const handleSave = async () => {
    if (!editingNews?.title || !editingNews?.content) {
      toast.error('Title and content are required')
      return
    }

    try {
      if (editingNews.id) {
        await updateNews.mutateAsync(editingNews as NewsItem & { id: string })
        toast.success('News updated')
      } else {
        await createNews.mutateAsync(editingNews)
        toast.success('News created')
      }
      setIsDialogOpen(false)
    } catch (error) {
      toast.error('Failed to save news')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this news item?')) return
    try {
      await deleteNews.mutateAsync(id)
      toast.success('News deleted')
    } catch (error) {
      toast.error('Failed to delete news')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-eve-accent" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button 
          onClick={() => handleOpenDialog()}
          className="bg-eve-accent text-black hover:bg-eve-accent/80 font-bold"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add News
        </Button>
      </div>

      <div className="bg-eve-panel/60 border border-eve-border/30 rounded-xl overflow-hidden">
        <AdminTable
          data={news || []}
          keyExtractor={(item) => item.id}
          columns={[
            {
              key: 'title',
              header: 'Title',
              render: (item) => (
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(item.category)}
                    <span className="font-medium text-eve-text">{item.title}</span>
                  </div>
                  <span className="text-xs text-eve-text/40 ml-6">
                    Published <FormattedDate date={item.createdAt} />
                  </span>
                </div>
              ),
            },
            {
              key: 'category',
              header: 'Category',
              render: (item) => (
                <span className="capitalize text-xs text-eve-text/60">
                  {item.category}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (item) => (
                <AdminBadge status={item.published ? 'success' : 'default'}>
                  {item.published ? 'Active' : 'Inactive'}
                </AdminBadge>
              ),
            },
            {
              key: 'actions',
              header: '',
              className: 'text-right',
              render: (item) => (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenDialog(item)}
                    className="text-eve-text/60 hover:text-eve-accent hover:bg-eve-accent/10"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                    className="text-eve-text/60 hover:text-red-400 hover:bg-red-400/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-eve-panel border-eve-border text-eve-text sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingNews?.id ? 'Edit News' : 'Create News'}</DialogTitle>
            <DialogDescription className="text-eve-text/60">
              Fill in the details for the news article.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={editingNews?.title || ''}
                onChange={(e) => setEditingNews(prev => ({ ...prev, title: e.target.value }))}
                className="bg-eve-background/50 border-eve-border/30"
                placeholder="News title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={editingNews?.category || 'news'}
                  onValueChange={(value) => setEditingNews(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger className="bg-eve-background/50 border-eve-border/30">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-eve-panel border-eve-border text-eve-text">
                    <SelectItem value="news">News</SelectItem>
                    <SelectItem value="patch">Patch Notes</SelectItem>
                    <SelectItem value="forum">Forum / Community</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-1 gap-2">
                <Switch
                  id="published"
                  checked={editingNews?.published ?? true}
                  onCheckedChange={(checked) => setEditingNews(prev => ({ ...prev, published: checked }))}
                />
                <Label htmlFor="published">Published</Label>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="image">Image URL</Label>
              <div className="flex gap-2">
                <Input
                  id="image"
                  value={editingNews?.imageUrl || ''}
                  onChange={(e) => setEditingNews(prev => ({ ...prev, imageUrl: e.target.value }))}
                  className="bg-eve-background/50 border-eve-border/30"
                  placeholder="https://..."
                />
                {editingNews?.imageUrl && (
                  <div className="relative w-10 h-10 rounded border border-eve-border overflow-hidden flex-shrink-0">
                    <Image src={editingNews.imageUrl} alt="Preview" fill className="object-cover" unoptimized />
                  </div>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={editingNews?.content || ''}
                onChange={(e) => setEditingNews(prev => ({ ...prev, content: e.target.value }))}
                className="bg-eve-background/50 border-eve-border/30 min-h-[200px]"
                placeholder="News content (Markdown supported)"
              />
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-eve-border">
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={createNews.isPending || updateNews.isPending}
              className="bg-eve-accent text-black hover:bg-eve-accent/80 font-bold"
            >
              {(createNews.isPending || updateNews.isPending) ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
