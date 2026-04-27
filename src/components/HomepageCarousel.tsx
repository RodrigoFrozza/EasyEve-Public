'use client'

import { useState, useEffect } from 'react'
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

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch('/api/homepage-carousel')
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
    fetchItems()
  }, [])

  const goToPrev = () => {
    if (items.length === 0) return
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length)
  }

  const goToNext = () => {
    if (items.length === 0) return
    setCurrentIndex((prev) => (prev + 1) % items.length)
  }

  if (loading) {
    return null
  }

  if (items.length === 0) {
    return null
  }

  const currentItem = items[currentIndex]

  const CarouselContent = () => (
    <div className="relative w-full aspect-video md:aspect-[21/9] lg:aspect-[2.5/1] overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentItem.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
        >
          {currentItem.link ? (
            <Link href={currentItem.link} className="block w-full h-full">
              <NextImage
                src={currentItem.imageUrl}
                alt={currentItem.altText || 'Carousel image'}
                fill
                className="object-cover"
                priority
              />
            </Link>
          ) : (
            <NextImage
              src={currentItem.imageUrl}
              alt={currentItem.altText || 'Carousel image'}
              fill
              className="object-cover"
              priority
            />
          )}
        </motion.div>
      </AnimatePresence>

      {items.length > 1 && (
        <>
          <button
            onClick={goToPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
            aria-label="Next image"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {items.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`transition-colors ${
                  index === currentIndex
                    ? 'text-eve-accent'
                    : 'text-white/50 hover:text-white'
                }`}
                aria-label={`Go to image ${index + 1}`}
              >
                <Circle
                  className={`h-3 w-3 ${
                    index === currentIndex ? 'fill-current' : 'fill-none'
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )

  return (
    <section id="carousel" className="relative w-full bg-eve-dark">
      <div className="max-w-7xl mx-auto px-4">
        <CarouselContent />
      </div>
    </section>
  )
}