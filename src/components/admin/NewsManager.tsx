'use client'

import { useState, useEffect } from 'react'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Newspaper, Megaphone, MessageSquare, Eye } from 'lucide-react'
import Image from 'next/image'
import { handleAdminError } from '@/lib/admin/error-handler'

import { useTranslations } from '@/i18n/hooks'

interface NewsItem {
  id: string
  title: string
  content: string
  imageUrl?: string
  category: string
  createdAt: string
  published: boolean
}

export function NewsManager() {
  const { t } = useTranslations()
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Form State
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [category, setCategory] = useState('news')

  const fetchNews = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/news?limit=20') // Get more for the admin manager
      if (res.ok) {
        setNews(await res.json())
      }
    } catch (err) {
      console.error('Failed to fetch news:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNews()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    
    try {
      const res = await fetch('/api/news', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ title, content, imageUrl, category })
      })

      if (res.ok) {
        toast.success(t('admin.codeGenerated30')) // Reuse or add specific news success
        setTitle('')
        setContent('')
        setImageUrl('')
        setCategory('news')
        setIsAdding(false)
        fetchNews()
      } else {
        const data = await res.json()
        handleAdminError(new Error(data.error || 'Failed to publish'), 'Failed to publish')
      }
    } catch (err) {
      handleAdminError(err, 'Failed to publish news')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('common.delete') + '?')) return
    
    try {
      const res = await fetch(`/api/news/${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        toast.success(t('admin.accountDeleted'))
        fetchNews()
      } else {
        const data = await res.json()
        handleAdminError(new Error(data.error || t('admin.deleteError')), t('admin.deleteError'))
      }
    } catch (err) {
      handleAdminError(err, t('admin.deleteError'))
    }
  }

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'patch': return <Megaphone className="h-3 w-3" />
      case 'forum': return <MessageSquare className="h-3 w-3" />
      default: return <Newspaper className="h-3 w-3" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-eve-accent" />
            {t('admin.manageNews')}
          </h2>
          <p className="text-xs text-gray-500">{t('admin.newsSubtitle')}</p>
        </div>
        <Button 
          onClick={() => setIsAdding(!isAdding)} 
          className={isAdding ? "bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20" : "bg-eve-accent text-black hover:bg-eve-accent/80 font-bold"}
        >
          {isAdding ? t('admin.cancel') : <><Plus className="h-4 w-4 mr-2" /> {t('admin.newNews')}</>}
        </Button>
      </div>


      {isAdding && (
        <Card className="bg-eve-panel border-eve-border shadow-2xl animate-in slide-in-from-top duration-300">
          <CardHeader>
            <CardTitle className="text-lg">{t('admin.newNews')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="title">{t('admin.newsTitle')}</Label>
                <Input 
                  id="title" 
                  placeholder="Ex: New server launched!" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-eve-dark border-eve-border"
                  required
                />
              </div>

<div className="grid md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="category">{t('admin.newsCategory')}</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="bg-eve-dark border-eve-border">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent className="bg-eve-panel border-eve-border">
                        <SelectItem value="news">News (General)</SelectItem>
                        <SelectItem value="patch">Patch Notes</SelectItem>
                        <SelectItem value="forum">Forum Announcement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="imageUrl">{t('admin.newsImage')}</Label>
                    <div className="flex gap-2">
                      <Input 
                        id="imageUrl" 
                        placeholder="https://..." 
                        value={imageUrl}
                        onChange={(e) => {
                          setImageUrl(e.target.value)
                          setShowPreview(true)
                        }}
                        className="bg-eve-dark border-eve-border flex-1"
                      />
                      {imageUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setShowPreview(!showPreview)}
                          className="border-eve-border"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {imageUrl && showPreview && (
                      <div className="mt-2 relative h-32 w-full rounded-lg overflow-hidden border border-eve-border bg-eve-dark">
                        <Image
                          src={imageUrl}
                          alt="Preview"
                          fill
                          className="object-cover"
                          onError={() => setShowPreview(false)}
                          onLoad={() => setShowPreview(true)}
                        />
                      </div>
                    )}
                  </div>
                </div>

              <div className="grid gap-2">
                <Label htmlFor="content">{t('admin.newsContent')}</Label>
                <Textarea 
                  id="content" 
                  placeholder="Write the news content here..." 
                  className="bg-eve-dark border-eve-border min-h-[150px]"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" disabled={submitting} className="w-full bg-eve-accent text-black font-bold py-6">
                {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Plus className="h-5 w-5 mr-2" />}
                {t('admin.publishNews')}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="bg-eve-panel border-eve-border overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-eve-accent" />
            </div>
          ) : news.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-eve-panel/40 rounded-xl border border-eve-border/30 text-center text-gray-500">
              {t('admin.noNews')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-eve-dark/50 border-b border-eve-border/30 text-gray-400 uppercase text-[10px] font-bold tracking-widest">
                  <tr>
                    <th className="px-6 py-4">{t('admin.dateTime')}</th>
                    <th className="px-6 py-4">{t('admin.newsTitle')}</th>
                    <th className="px-6 py-4">{t('admin.newsCategory')}</th>
                    <th className="px-6 py-4 text-right">{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-eve-border/30">
                  {news.map((item) => (
                    <tr key={item.id} className="hover:bg-eve-dark/10 transition-colors group">
                      <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                        <FormattedDate date={item.createdAt} />
                      </td>
                      <td className="px-6 py-4 font-bold text-white max-w-xs truncate">
                        {item.title}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="text-[10px] flex items-center gap-1.5 w-fit bg-white/5">
                          {getCategoryIcon(item.category)}
                          {item.category.toUpperCase()}
                        </Badge>
                      </td>
<td className="px-6 py-4 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500 hover:bg-red-500/10"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>

                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
