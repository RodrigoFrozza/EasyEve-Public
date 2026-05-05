'use client'

import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'

interface ShootingStar {
  x: number
  y: number
  length: number
  speed: number
  alpha: number
  angle: number
}

export function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let isTabVisible = !document.hidden

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    
    window.addEventListener('resize', resize)
    resize()

    const starCount = prefersReducedMotion ? 120 : 400
    const stars: { x: number; y: number; z: number; size: number; alpha: number; speed: number; twinklingSpeed: number }[] = []
    let shootingStars: ShootingStar[] = []
    
    // Create stars with different depths (z)
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        z: Math.random() * 3, // 0 to 3 depth
        size: Math.random() * 1.5 + 0.1,
        alpha: Math.random(),
        speed: (Math.random() * 0.05 + 0.01),
        twinklingSpeed: Math.random() * 0.015 + 0.005,
      })
    }

    const createShootingStar = () => {
      
      const angle = (Math.random() * 45 + 135) * (Math.PI / 180) // 135 to 180 degrees (top-right to bottom-left)
      shootingStars.push({
        x: Math.random() * canvas.width * 1.5,
        y: -50,
        length: Math.random() * 80 + 20,
        speed: Math.random() * 15 + 10,
        alpha: 1,
        angle
      })
    }

    let scrollY = window.scrollY

    const handleScroll = () => {
      scrollY = window.scrollY
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const render = () => {
      if (!isTabVisible) {
        animationFrameId = requestAnimationFrame(render)
        return
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Update & Draw Stars
      stars.forEach((star) => {
        const parallaxOffset = scrollY * (star.z * 0.15)
        let yPos = star.y - parallaxOffset
        
        if (yPos < 0) {
           yPos = canvas.height - (Math.abs(yPos) % canvas.height)
        } else if (yPos > canvas.height) {
           yPos = yPos % canvas.height
        }

        // Pulse/Twinkle effect - Always run for visual life, regardless of reduced motion
        star.alpha += star.twinklingSpeed
        if (star.alpha >= 1 || star.alpha <= 0.2) {
          star.twinklingSpeed = -star.twinklingSpeed
        }

        if (!prefersReducedMotion) {
           star.x -= star.speed
           if (star.x < 0) star.x = canvas.width
        }

        ctx.beginPath()
        ctx.arc(star.x, yPos, star.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(245, 250, 255, ${star.alpha})`
        ctx.fill()

        // Add subtle cross-flare to bright/large stars (skip in reduced motion)
        if (!prefersReducedMotion && star.size > 1.2 && star.alpha > 0.7) {
          ctx.beginPath()
          ctx.strokeStyle = `rgba(255, 255, 255, ${star.alpha * 0.3})`
          ctx.lineWidth = 0.5
          // Horizontal flare
          ctx.moveTo(star.x - star.size * 4, yPos)
          ctx.lineTo(star.x + star.size * 4, yPos)
          // Vertical flare
          ctx.moveTo(star.x, yPos - star.size * 4)
          ctx.lineTo(star.x, yPos + star.size * 4)
          ctx.stroke()
        }
      })

      // Update & Draw Shooting Stars (skip in reduced motion)
      if (!prefersReducedMotion && Math.random() < 0.012) {
        createShootingStar()
      }

      if (!prefersReducedMotion) {
        shootingStars = shootingStars.filter(ss => ss.alpha > 0)
        shootingStars.forEach((ss) => {
          ss.x -= Math.cos(ss.angle) * ss.speed
          ss.y += Math.sin(ss.angle) * ss.speed
          ss.alpha -= 0.012 // Slightly slower fade for more visibility
  
          if (ss.alpha > 0) {
            ctx.beginPath()
            ctx.lineWidth = 2 // Slightly thicker
            ctx.lineCap = 'round'
            ctx.strokeStyle = `rgba(255, 255, 255, ${ss.alpha})`
            ctx.moveTo(ss.x, ss.y)
            ctx.lineTo(
              ss.x + Math.cos(ss.angle) * ss.length,
              ss.y - Math.sin(ss.angle) * ss.length
            )
            ctx.stroke()
            
            // Add a small head glow
            const gradient = ctx.createRadialGradient(ss.x, ss.y, 0, ss.x, ss.y, 6)
            gradient.addColorStop(0, `rgba(255, 255, 255, ${ss.alpha})`)
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
            ctx.fillStyle = gradient
            ctx.arc(ss.x, ss.y, 6, 0, Math.PI * 2)
            ctx.fill()
          }
        })
      }
      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      cancelAnimationFrame(animationFrameId)
    }
  }, [prefersReducedMotion])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
      aria-hidden="true"
    />
  )
}