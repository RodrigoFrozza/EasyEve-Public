'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, GripVertical, Image as ImageIcon, ExternalLink, Eye, EyeOff, Upload, X } from 'lucide-react'
import NextImage from 'next/image'
import { handleAdminError } from '@/lib/admin/error-handler'
import { useTranslations } from '@/i18n/hooks'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

interface CarouselItem {
  id: string
  imageUrl: string
  altText: string | null
  link: string | null
  order: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export function CarouselManager() {
  const { t } = useTranslations()
  const [items, setItems] = useState<CarouselItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CarouselItem | null>(null)

  const [imageUrl, setImageUrl] = useState('')
  const [altText, setAltText] = useState('')
  const [link, setLink] = useState('')
  const [isActive, setIsActive] = useState(true)
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchItems = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/homepage-carousel')
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
      }
    } catch (err) {
      console.error('Failed to fetch carousel items:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  const resetForm = () => {
    setImageUrl('')
    setAltText('')
    setLink('')
    setIsActive(true)
    setEditingItem(null)
    setSelectedFile(null)
    setPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleOpenAdd = () => {
    resetForm()
    setIsAddOpen(true)
  }

  const handleOpenEdit = (item: CarouselItem) => {
    setImageUrl(item.imageUrl)
    setAltText(item.altText || '')
    setLink(item.link || '')
    setIsActive(item.active)
    setEditingItem(item)
    setSelectedFile(null)
    setPreviewUrl(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File too large (max 5MB)')
        return
      }
      setSelectedFile(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    }
  }

  const clearFile = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      let finalImageUrl = imageUrl

      // If a local file is selected, upload it first
      if (selectedFile) {
        const formData = new FormData()
        formData.append('file', selectedFile)

        const uploadRes = await fetch('/api/admin/homepage-carousel/upload', {
          method: 'POST',
          body: formData
        })

        if (!uploadRes.ok) {
          const error = await uploadRes.json()
          throw new Error(error.error || 'Failed to upload image')
        }

        const uploadData = await uploadRes.json()
        finalImageUrl = uploadData.url
      }

      if (!finalImageUrl) {
        throw new Error('Image is required')
      }

      const payload = {
        imageUrl: finalImageUrl,
        altText: altText || null,
        link: link || null,
        active: isActive,
      }

      let res
      if (editingItem) {
        res = await fetch('/api/admin/homepage-carousel', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingItem.id, ...payload })
        })
      } else {
        res = await fetch('/api/admin/homepage-carousel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }

      if (res.ok) {
        toast.success(editingItem ? t('admin.updated30') : t('admin.codeGenerated30'))
        setIsAddOpen(false)
        resetForm()
        fetchItems()
      } else {
        throw new Error('Failed to save')
      }
    } catch (err) {
      handleAdminError(err, 'Failed to save image')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return

    try {
      const res = await fetch('/api/admin/homepage-carousel', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })

      if (res.ok) {
        toast.success('Image deleted')
        fetchItems()
      }
    } catch (err) {
      handleAdminError(err, 'Failed to delete image')
    }
  }

  const handleToggleActive = async (item: CarouselItem) => {
    try {
      const res = await fetch('/api/admin/homepage-carousel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, active: !item.active })
      })

      if (res.ok) {
        fetchItems()
      }
    } catch (err) {
      handleAdminError(err, 'Failed to update status')
    }
  }

  const updateOrder = async (id: string, newOrder: number) => {
    try {
      const res = await fetch('/api/admin/homepage-carousel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, order: newOrder })
      })

      if (res.ok) {
        fetchItems()
      }
    } catch (err) {
      handleAdminError(err, 'Failed to update order')
    }
  }

  const moveItem = (id: string, direction: 'up' | 'down') => {
    const index = items.findIndex(item => item.id === id)
    if (index === -1) return

    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === items.length - 1) return

    const newOrder = direction === 'up' ? index - 1 : index + 1
    updateOrder(items[index].id, newOrder)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Homepage Carousel</h2>
          <p className="text-gray-400">Manage the images displayed on the homepage carousel</p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-eve-accent hover:bg-cyan-400 text-black font-semibold">
          <Plus className="h-4 w-4 mr-2" />
          Add Image
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-eve-accent" />
        </div>
      ) : items.length === 0 ? (
        <Card className="bg-eve-panel border-eve-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ImageIcon className="h-12 w-12 text-gray-500 mb-4" />
            <p className="text-gray-400 mb-4">No images added yet</p>
            <Button onClick={handleOpenAdd} variant="outline" className="border-eve-border text-gray-300 hover:bg-eve-dark hover:text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add First Image
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {items.map((item, index) => (
            <Card key={item.id} className="bg-eve-panel border-eve-border hover:border-eve-accent/30 transition-colors">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-400 hover:text-white"
                    onClick={() => moveItem(item.id, 'up')}
                    disabled={index === 0}
                  >
                    <GripVertical className="h-4 w-4 rotate-90" />
                  </Button>
                  <span className="text-xs text-gray-500 text-center font-mono">{item.order}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-400 hover:text-white"
                    onClick={() => moveItem(item.id, 'down')}
                    disabled={index === items.length - 1}
                  >
                    <GripVertical className="h-4 w-4 rotate-90" />
                  </Button>
                </div>

                <div className="relative h-24 w-40 rounded-lg overflow-hidden bg-black flex-shrink-0 border border-eve-border/50">
                  {item.imageUrl ? (
                    <NextImage
                      src={item.imageUrl}
                      alt={item.altText || 'Carousel image'}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-eve-dark">
                      <ImageIcon className="h-8 w-8 text-gray-500" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white truncate">
                      {item.altText || 'Untitled image'}
                    </span>
                    <Badge variant={item.active ? 'default' : 'secondary'} className={item.active ? 'bg-green-600/20 text-green-400 border-green-600/50' : 'bg-gray-600/20 text-gray-400 border-gray-600/50'}>
                      {item.active ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                      {item.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 truncate font-mono bg-black/30 p-1 rounded mt-1">{item.imageUrl}</p>
                  {item.link && (
                    <div className="flex items-center gap-1 text-sm text-eve-accent mt-1">
                      <ExternalLink className="h-3 w-3" />
                      <span className="truncate">{item.link}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-eve-border text-gray-300 hover:bg-eve-dark hover:text-white"
                    onClick={() => handleToggleActive(item)}
                  >
                    {item.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-eve-border text-gray-300 hover:bg-eve-dark hover:text-white"
                    onClick={() => {
                      handleOpenEdit(item)
                      setIsAddOpen(true)
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-600/50 text-red-400 hover:bg-red-900/20"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[525px] bg-eve-panel border-eve-border text-white p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>{editingItem ? 'Edit Image' : 'Add New Image'}</DialogTitle>
            <DialogDescription className="text-gray-400">
              {editingItem ? 'Update the carousel image settings' : 'Add a new image to the homepage carousel'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="p-6 pt-4">
            <div className="grid gap-6">
              {/* Image Selection Area */}
              <div className="grid gap-3">
                <Label>Image Source</Label>
                
                <div className="grid gap-4">
                  {/* File Upload Section */}
                  <div 
                    className={`relative border-2 border-dashed rounded-lg p-4 transition-colors ${
                      previewUrl ? 'border-eve-accent/50 bg-eve-accent/5' : 'border-eve-border hover:border-gray-500 bg-eve-dark/50'
                    }`}
                  >
                    {previewUrl ? (
                      <div className="relative aspect-video rounded-md overflow-hidden">
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7 rounded-full"
                          onClick={clearFile}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-4 text-center">
                        <Upload className="h-8 w-8 text-gray-500 mb-2" />
                        <p className="text-sm text-gray-400 mb-2">Upload from your local machine</p>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          className="border-eve-border bg-eve-dark"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Choose File
                        </Button>
                        <p className="text-[10px] text-gray-500 mt-2">JPG, PNG, WEBP, GIF (Max 5MB)</p>
                      </div>
                    )}
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-eve-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-eve-panel px-2 text-gray-500">Or use URL</span>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Input
                      id="imageUrl"
                      value={imageUrl}
                      onChange={(e) => {
                        setImageUrl(e.target.value)
                        if (e.target.value && selectedFile) clearFile()
                      }}
                      placeholder="https://example.com/image.jpg"
                      className="bg-eve-dark border-eve-border"
                      disabled={!!selectedFile}
                    />
                    <p className="text-[10px] text-gray-500">Manual URL entry is disabled if a file is selected</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="altText">Alt Text</Label>
                  <Input
                    id="altText"
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    placeholder="Brief description"
                    className="bg-eve-dark border-eve-border"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="link">Link (optional)</Label>
                  <Input
                    id="link"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="/dashboard"
                    className="bg-eve-dark border-eve-border"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 bg-eve-dark/30 p-3 rounded-lg border border-eve-border/50">
                <Switch
                  id="active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="active" className="text-sm font-medium">Make this image active immediately</Label>
              </div>
            </div>

            <DialogFooter className="mt-8 gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)} className="text-gray-400 hover:text-white hover:bg-white/5">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || (!imageUrl && !selectedFile)} className="bg-eve-accent hover:bg-cyan-400 text-black font-bold px-8">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingItem ? 'Update Item' : 'Add to Carousel'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}