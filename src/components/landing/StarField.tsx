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

interface NebulaCloud {
  x: number
  y: number
  r: number
  color1: string
  color2: string
  vx: number
  vy: number
}

type StarFieldVariant = 'default' | 'subtle'

interface StarFieldProps {
  variant?: StarFieldVariant
}

export function StarField({ variant = 'default' }: StarFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const isSubtle = variant === 'subtle'

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

    const starCount = prefersReducedMotion
      ? isSubtle ? 60 : 100
      : isSubtle ? 180 : 350
    const stars: {
      x: number
      y: number
      z: number
      size: number
      alpha: number
      speed: number
      twinklingSpeed: number
      colorPrefix: string
    }[] = []
    
    let shootingStars: ShootingStar[] = []
    
    // Create colored stars for high-tech telemetry ambiance
    const starColors = [
      'rgba(245, 250, 255, ', // warm white
      'rgba(165, 243, 252, ', // cool EVE cyan
      'rgba(253, 230, 138, ', // amber/yellow warnings
      'rgba(224, 242, 254, ', // soft blue
    ]

    for (let i = 0; i < starCount; i++) {
      const colorPrefix = starColors[Math.floor(Math.random() * starColors.length)]
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        z: Math.random() * 3 + 0.5, // Parallax depth layer
        size: Math.random() * 1.5 + 0.2,
        alpha: Math.random() * 0.8 + 0.2,
        speed: (Math.random() * 0.03 + 0.01),
        twinklingSpeed: Math.random() * 0.01 + 0.003,
        colorPrefix,
      })
    }

    const nebulas: NebulaCloud[] = isSubtle
      ? [
          {
            x: canvas.width * 0.75,
            y: canvas.height * 0.35,
            r: Math.min(canvas.width, canvas.height) * 0.55,
            color1: 'rgba(6, 182, 212, 0.02)',
            color2: 'rgba(6, 182, 212, 0)',
            vx: -0.008,
            vy: 0.01,
          },
        ]
      : [
          {
            x: canvas.width * 0.2,
            y: canvas.height * 0.25,
            r: Math.min(canvas.width, canvas.height) * 0.6,
            color1: 'rgba(124, 58, 237, 0.045)',
            color2: 'rgba(124, 58, 237, 0)',
            vx: 0.015,
            vy: -0.008,
          },
          {
            x: canvas.width * 0.8,
            y: canvas.height * 0.65,
            r: Math.min(canvas.width, canvas.height) * 0.7,
            color1: 'rgba(6, 182, 212, 0.04)',
            color2: 'rgba(6, 182, 212, 0)',
            vx: -0.012,
            vy: 0.015,
          },
          {
            x: canvas.width * 0.5,
            y: canvas.height * 0.4,
            r: Math.min(canvas.width, canvas.height) * 0.5,
            color1: 'rgba(236, 72, 153, 0.025)',
            color2: 'rgba(236, 72, 153, 0)',
            vx: 0.008,
            vy: 0.01,
          },
        ]

    const createShootingStar = () => {
      const angle = (Math.random() * 35 + 145) * (Math.PI / 180) // 145 to 180 degrees (top-right to bottom-left)
      shootingStars.push({
        x: Math.random() * canvas.width * 1.3,
        y: -50,
        length: Math.random() * 100 + 40,
        speed: Math.random() * 12 + 8,
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

      ctx.fillStyle = '#03070c'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Draw procedural nebulas (skip if reduced motion to save battery/resources)
      if (!prefersReducedMotion) {
        nebulas.forEach((n) => {
          // Slow parallax
          const parallaxOffset = scrollY * 0.05
          let yPos = n.y - parallaxOffset

          // Slowly drift positions
          n.x += n.vx
          n.y += n.vy

          // Wrap boundaries
          if (n.x < -n.r) n.x = canvas.width + n.r
          if (n.x > canvas.width + n.r) n.x = -n.r
          if (yPos < -n.r) n.y = canvas.height + n.r + parallaxOffset
          if (yPos > canvas.height + n.r) n.y = -n.r + parallaxOffset

          try {
            const radGrad = ctx.createRadialGradient(n.x, yPos, 0, n.x, yPos, n.r)
            radGrad.addColorStop(0, n.color1)
            radGrad.addColorStop(0.4, n.color1.replace('0.0', '0.01'))
            radGrad.addColorStop(1, n.color2)
            
            ctx.fillStyle = radGrad
            ctx.beginPath()
            ctx.arc(n.x, yPos, n.r, 0, Math.PI * 2)
            ctx.fill()
          } catch (e) {
            // Safe fallback
          }
        })
      }
      
      // Update & Draw Stars
      stars.forEach((star) => {
        const parallaxOffset = scrollY * (star.z * 0.08)
        let yPos = star.y - parallaxOffset
        
        if (yPos < 0) {
          yPos = canvas.height - (Math.abs(yPos) % canvas.height)
        } else if (yPos > canvas.height) {
          yPos = yPos % canvas.height
        }

        // Pulse/Twinkle effect
        star.alpha += star.twinklingSpeed
        if (star.alpha >= 1 || star.alpha <= 0.15) {
          star.twinklingSpeed = -star.twinklingSpeed
        }

        if (!prefersReducedMotion) {
          star.x -= star.speed
          if (star.x < 0) star.x = canvas.width
        }

        ctx.beginPath()
        ctx.arc(star.x, yPos, star.size, 0, Math.PI * 2)
        ctx.fillStyle = `${star.colorPrefix}${star.alpha})`
        ctx.fill()

        // Subtle cross-flare for bright stars
        if (!prefersReducedMotion && star.size > 1.2 && star.alpha > 0.75) {
          ctx.beginPath()
          ctx.strokeStyle = `${star.colorPrefix}${star.alpha * 0.25})`
          ctx.lineWidth = 0.5
          // Horizontal
          ctx.moveTo(star.x - star.size * 3.5, yPos)
          ctx.lineTo(star.x + star.size * 3.5, yPos)
          // Vertical
          ctx.moveTo(star.x, yPos - star.size * 3.5)
          ctx.lineTo(star.x, yPos + star.size * 3.5)
          ctx.stroke()
        }
      })

      // Update & Draw Shooting Stars (skip in reduced motion)
      const shootingChance = isSubtle ? 0.003 : 0.008
      if (!prefersReducedMotion && Math.random() < shootingChance) {
        createShootingStar()
      }

      if (!prefersReducedMotion) {
        shootingStars = shootingStars.filter(ss => ss.alpha > 0)
        shootingStars.forEach((ss) => {
          ss.x -= Math.cos(ss.angle) * ss.speed
          ss.y += Math.sin(ss.angle) * ss.speed
          ss.alpha -= 0.015 // Slower, more visual trail

          if (ss.alpha > 0) {
            ctx.beginPath()
            ctx.lineWidth = 1.5
            ctx.lineCap = 'round'
            ctx.strokeStyle = `rgba(165, 243, 252, ${ss.alpha})` // EVE cyan glow
            ctx.moveTo(ss.x, ss.y)
            ctx.lineTo(
              ss.x + Math.cos(ss.angle) * ss.length,
              ss.y - Math.sin(ss.angle) * ss.length
            )
            ctx.stroke()
            
            // Subtle head glow
            const gradient = ctx.createRadialGradient(ss.x, ss.y, 0, ss.x, ss.y, 5)
            gradient.addColorStop(0, `rgba(255, 255, 255, ${ss.alpha})`)
            gradient.addColorStop(1, 'rgba(165, 243, 252, 0)')
            ctx.fillStyle = gradient
            ctx.beginPath()
            ctx.arc(ss.x, ss.y, 5, 0, Math.PI * 2)
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
  }, [prefersReducedMotion, isSubtle])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
      aria-hidden="true"
    />
  )
}