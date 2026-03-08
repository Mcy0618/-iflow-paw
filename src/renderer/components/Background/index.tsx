import React, { useEffect, useRef } from 'react'
import { useTheme } from '../../hooks/useTheme'

/**
 * 动态背景组件
 * 包含网格背景、粒子动画和渐变光晕效果
 */
export const Background: React.FC = () => {
  const { isDark } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()

  // 粒子系统
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 设置画布尺寸
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // 粒子配置
    const particleCount = 50
    const particles: Particle[] = []

    interface Particle {
      x: number
      y: number
      vx: number
      vy: number
      radius: number
      opacity: number
    }

    // 初始化粒子
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 1,
        opacity: Math.random() * 0.5 + 0.1,
      })
    }

    // 动画循环
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 更新和绘制粒子
      particles.forEach((particle) => {
        particle.x += particle.vx
        particle.y += particle.vy

        // 边界检测
        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1

        // 绘制粒子
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
        ctx.fillStyle = isDark 
          ? `rgba(99, 102, 241, ${particle.opacity})`
          : `rgba(99, 102, 241, ${particle.opacity * 0.5})`
        ctx.fill()
      })

      // 绘制粒子连线
      particles.forEach((p1, i) => {
        particles.slice(i + 1).forEach((p2) => {
          const dx = p1.x - p2.x
          const dy = p1.y - p2.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < 150) {
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.strokeStyle = isDark
              ? `rgba(99, 102, 241, ${0.1 * (1 - distance / 150)})`
              : `rgba(99, 102, 241, ${0.05 * (1 - distance / 150)})`
            ctx.stroke()
          }
        })
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isDark])

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* 网格背景 */}
      <div 
        className={`absolute inset-0 ${
          isDark ? 'opacity-20' : 'opacity-30'
        }`}
        style={{
          backgroundImage: `
            linear-gradient(${isDark ? 'rgba(99, 102, 241, 0.03)' : 'rgba(99, 102, 241, 0.05)'} 1px, transparent 1px),
            linear-gradient(90deg, ${isDark ? 'rgba(99, 102, 241, 0.03)' : 'rgba(99, 102, 241, 0.05)'} 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* 渐变光晕 */}
      <div className="absolute inset-0">
        {/* 左上角光晕 */}
        <div 
          className={`absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl animate-float ${
            isDark 
              ? 'bg-primary-500/10' 
              : 'bg-primary-200/40'
          }`}
          style={{ animationDelay: '0s' }}
        />
        
        {/* 右下角光晕 */}
        <div 
          className={`absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-3xl animate-float ${
            isDark 
              ? 'bg-purple-500/10' 
              : 'bg-purple-200/40'
          }`}
          style={{ animationDelay: '1.5s' }}
        />
        
        {/* 中间光晕 */}
        <div 
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl ${
            isDark 
              ? 'bg-primary-600/5' 
              : 'bg-primary-100/20'
          }`}
        />
      </div>

      {/* 粒子画布 */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ opacity: 0.6 }}
      />

      {/* 渐变叠加层 */}
      <div 
        className={`absolute inset-0 ${
          isDark 
            ? 'bg-gradient-to-br from-slate-900/50 via-transparent to-slate-900/50' 
            : 'bg-gradient-to-br from-white/30 via-transparent to-white/30'
        }`}
      />
    </div>
  )
}

export default Background
