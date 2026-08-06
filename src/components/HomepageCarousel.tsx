'use client'

import { useState, useEffect, useCallback } from 'react'
import NextImage from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { EASE_OUT_EXPO } from '@/lib/motion-easing'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CarouselItem {
  id: string
  imageUrl: string
  altText: string | null
  link: string | null
  order: number
  active: boolean
}

export function HomepageCarousel() {
  const [items, setItems] = useState<CarouselItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [progress, setProgress] = useState(0)

  const AUTO_PLAY_INTERVAL = 8000

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch('/api/homepage-carousel')
        if (res.ok) {
          const data = await res.json()
          const mappedItems = (data.items || []).map((item: CarouselItem) => ({
            ...item,
            imageUrl: item.imageUrl.startsWith('/uploads/carousel/') 
              ? item.imageUrl.replace('/uploads/carousel/', '/api/media/carousel/') 
              : item.imageUrl
          }))
          setItems(mappedItems)
        }
      } catch (err) {
        console.error('Failed to fetch carousel items:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchItems()
  }, [])

  const goToNext = useCallback(() => {
    if (items.length === 0) return
    setCurrentIndex((prev) => (prev + 1) % items.length)
    setProgress(0)
  }, [items.length])

  const goToPrev = useCallback(() => {
    if (items.length === 0) return
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length)
    setProgress(0)
  }, [items.length])

  useEffect(() => {
    if (items.length <= 1) return

    const startTime = Date.now()
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime
      const newProgress = Math.min((elapsed / AUTO_PLAY_INTERVAL) * 100, 100)
      setProgress(newProgress)

      if (newProgress >= 100) {
        goToNext()
      }
    }, 100)

    return () => clearInterval(timer)
  }, [currentIndex, items.length, goToNext])

  if (loading || items.length === 0) return (
    <div className="w-full aspect-video md:aspect-[21/9] bg-eve-dark flex flex-col items-center justify-center border border-eve-border/30 rounded-xs">
      <div className="text-eve-muted text-sm animate-pulse">
        Carregando imagens…
      </div>
    </div>
  )

  const currentItem = items[currentIndex]

  return (
    <div className="relative w-full aspect-video md:aspect-[21/9] bg-black group overflow-hidden rounded-xs font-accent">
      {/* Main Image with stunning motion crossfades */}
      <div className="absolute inset-0 z-0 bg-eve-dark">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 0.65, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
            className="absolute inset-0"
          >
            <NextImage
              src={currentItem.imageUrl}
              alt={currentItem.altText || ''}
              fill
              className="object-cover grayscale-[0.25] group-hover:grayscale-0 transition-all duration-700"
              priority
            />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent pointer-events-none" />
      </div>

      {/* Cyberpunk Scanline overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none opacity-[0.02] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />

      {/* Frame Headers / Telemetry metadata */}
      <div className="absolute top-6 left-6 z-20 flex flex-wrap items-center gap-3">
        <div className="px-3 py-1 bg-eve-accent text-eve-dark text-xs font-medium rounded-sm shadow-eve-accent-glow-sm">
          Captura de tela
        </div>
      </div>

      {/* Cyber Panel Controllers */}
      <div className="absolute bottom-6 right-6 z-20 flex bg-eve-panel/90 border border-eve-border rounded-xs overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <button 
          onClick={goToPrev}
          className="p-4 bg-transparent hover:bg-eve-accent hover:text-eve-dark text-eve-muted transition-colors duration-250 border-r border-eve-border"
          aria-label="Previous Frame"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button 
          onClick={goToNext}
          className="p-4 bg-transparent hover:bg-eve-accent hover:text-eve-dark text-eve-muted transition-colors duration-250"
          aria-label="Next Frame"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Subtitles & HUD Description */}
      {currentItem.altText && (
        <div className="absolute bottom-6 left-6 z-20 max-w-lg">
          <div className="p-5 bg-black/85 border-l-2 border-eve-accent backdrop-blur-md rounded-r-xs shadow-[0_0_25px_rgba(0,0,0,0.6)]">
            <p className="text-eve-text text-sm leading-relaxed">{currentItem.altText}</p>
          </div>
        </div>
      )}

      {/* Bottom telemetry progress line */}
      <div className="absolute bottom-0 left-0 right-0 z-30 h-[2.5px] bg-eve-dark">
        <div
          className="h-full bg-eve-accent shadow-eve-accent-glow-sm transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* HUD Frame Counter */}
      <div className="absolute top-6 right-6 z-20 text-xs text-eve-muted bg-eve-dark/90 px-3 py-1 border border-eve-border/60 rounded-sm">
        {currentIndex + 1} / {items.length}
      </div>
    </div>
  )
}