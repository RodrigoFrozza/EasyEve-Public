'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from '@/i18n/hooks'
import NextImage from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Circle } from 'lucide-react'

interface CarouselItem {
  id: string
  imageUrl: string
  altText: string | null
  link: string | null
  order: number
  active: boolean
}

export function HomepageCarousel() {
  const { t } = useTranslations()
  const [items, setItems] = useState<CarouselItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [progress, setProgress] = useState(0)

  const AUTO_PLAY_INTERVAL = 6000 // 6 seconds

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

  const goToPrev = useCallback(() => {
    if (items.length === 0) return
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length)
    setProgress(0)
  }, [items.length])

  const goToNext = useCallback(() => {
    if (items.length === 0) return
    setCurrentIndex((prev) => (prev + 1) % items.length)
    setProgress(0)
  }, [items.length])

  // Auto-play logic with progress bar
  useEffect(() => {
    if (items.length <= 1 || isHovered) {
      setProgress(0)
      return
    }

    const startTime = Date.now()
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime
      const newProgress = Math.min((elapsed / AUTO_PLAY_INTERVAL) * 100, 100)
      setProgress(newProgress)

      if (newProgress >= 100) {
        goToNext()
      }
    }, 50)

    return () => clearInterval(timer)
  }, [currentIndex, items.length, isHovered, goToNext])

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="w-full aspect-video md:aspect-[21/9] bg-eve-dark/50 animate-pulse rounded-xl border border-white/5" />
    </div>
  )
  
  if (items.length === 0) return null

  const currentItem = items[currentIndex]

  return (
    <section id="carousel" className="relative w-full py-12 bg-eve-black overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(circle_at_center,rgba(0,212,255,0.05)_0%,transparent_70%)] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4">
        <div 
          className="group relative w-full aspect-video md:aspect-[21/9] lg:aspect-[2.5/1] overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_50px_-12px_rgba(0,212,255,0.2)]"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentItem.id}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 bg-eve-dark"
            >
               {/* Blurred Background */}
               <div className="absolute inset-0 z-0">
                 <NextImage
                   src={currentItem.imageUrl}
                   alt=""
                   fill
                   className="object-cover blur-3xl opacity-30 scale-125"
                   aria-hidden="true"
                   sizes="100vw"
                 />
                 <div className="absolute inset-0 bg-gradient-to-t from-eve-black via-transparent to-eve-black/50" />
                 <div 
                   className="absolute inset-0 opacity-10" 
                   style={{ 
                     backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                     backgroundSize: '40px 40px' 
                   }} 
                 />
               </div>

              {/* Scanline Effect */}
              <div className="absolute inset-0 z-10 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />

               {/* Main Content */}
               <div className="relative z-20 w-full h-full flex items-center justify-center p-4 md:p-8">
                 {currentItem.link ? (
                   <Link href={currentItem.link} className="block w-full h-full relative group/link">
                     <NextImage
                       src={currentItem.imageUrl}
                       alt={currentItem.altText || 'Carousel image'}
                       fill
                       className="object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-transform duration-700 group-hover/link:scale-[1.02]"
                       sizes="(max-width: 768px) 100vw, (max-width: 1024px) 80vw, 70vw"
                       priority={currentIndex === 0}
                     />
                     
                     {/* Caption Overlay */}
                     {currentItem.altText && (
                       <div className="absolute bottom-6 left-6 right-6 z-30 opacity-0 translate-y-4 transition-all duration-500 group-hover/link:opacity-100 group-hover/link:translate-y-0 hidden md:block">
                         <div className="inline-block px-6 py-3 rounded-lg bg-black/40 backdrop-blur-xl border border-white/10 text-white font-accent text-lg">
                           {currentItem.altText}
                         </div>
                       </div>
                     )}
                   </Link>
                 ) : (
                   <div className="w-full h-full relative">
                     <NextImage
                       src={currentItem.imageUrl}
                       alt={currentItem.altText || 'Carousel image'}
                       fill
                       className="object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                       sizes="(max-width: 768px) 100vw, (max-width: 1024px) 80vw, 70vw"
                       priority={currentIndex === 0}
                     />
                     {currentItem.altText && (
                       <div className="absolute bottom-6 left-6 z-30 hidden md:block">
                         <div className="px-6 py-3 rounded-lg bg-black/40 backdrop-blur-xl border border-white/10 text-white font-accent">
                           {currentItem.altText}
                         </div>
                       </div>
                     )}
                   </div>
                 )}
               </div>
            </motion.div>
          </AnimatePresence>

          {/* Controls */}
          {items.length > 1 && (
            <>
              <button
                onClick={goToPrev}
                className="absolute z-40 left-6 top-1/2 -translate-y-1/2 p-3 rounded-xl bg-black/20 hover:bg-eve-accent/20 backdrop-blur-md border border-white/10 text-white transition-all duration-300 hover:scale-110 active:scale-95 group/btn"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-6 w-6 transition-transform group-hover/btn:-translate-x-0.5" />
              </button>

              <button
                onClick={goToNext}
                className="absolute z-40 right-6 top-1/2 -translate-y-1/2 p-3 rounded-xl bg-black/20 hover:bg-eve-accent/20 backdrop-blur-md border border-white/10 text-white transition-all duration-300 hover:scale-110 active:scale-95 group/btn"
                aria-label="Next image"
              >
                <ChevronRight className="h-6 w-6 transition-transform group-hover/btn:translate-x-0.5" />
              </button>

              {/* Progress Bar (Auto-play) */}
              <div className="absolute top-0 left-0 right-0 z-50 h-1 bg-white/5">
                <motion.div 
                  className="h-full bg-eve-accent shadow-[0_0_8px_rgba(0,212,255,0.8)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.1, ease: "linear" }}
                />
              </div>

              {/* Indicators */}
              <div className="absolute z-40 bottom-6 left-1/2 -translate-x-1/2 flex gap-3 px-4 py-2 rounded-full bg-black/20 backdrop-blur-md border border-white/10">
                {items.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setCurrentIndex(index)
                      setProgress(0)
                    }}
                    className="relative group/dot"
                    aria-label={`Go to image ${index + 1}`}
                  >
                    <Circle
                      className={`h-2.5 w-2.5 transition-all duration-300 ${
                        index === currentIndex 
                          ? 'text-eve-accent fill-current scale-125' 
                          : 'text-white/30 fill-none hover:text-white/60'
                      }`}
                    />
                    {index === currentIndex && (
                      <span className="absolute inset-0 rounded-full bg-eve-accent/40 animate-ping" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}