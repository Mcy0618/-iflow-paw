import React from 'react'
import { useTheme } from '../../hooks/useTheme'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'elevated' | 'subtle'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

/**
 * 玻璃拟态卡片组件 - 统一的卡片容器样式
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
}) => {
  const { isDark } = useTheme()
  
  const baseStyles = 'backdrop-blur-sm rounded-2xl relative overflow-hidden'
  
  const variantStyles = {
    default: isDark 
      ? 'bg-slate-800/90 border border-slate-700/50 shadow-slate-900/20'
      : 'bg-white/90 border border-slate-200/60 shadow-slate-200/50',
    elevated: isDark
      ? 'bg-slate-800/95 border border-slate-700/70 shadow-lg shadow-slate-900/30'
      : 'bg-white/95 border border-slate-200/80 shadow-lg shadow-slate-200/50',
    subtle: isDark
      ? 'bg-slate-800/70 border border-slate-700/30'
      : 'bg-white/70 border border-slate-200/40',
  }
  
  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6',
  }
  
  return (
    <div className={`${baseStyles} ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}>
      {/* 边框光效动画 */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden">
        <div 
          className="absolute inset-0 animate-shimmer opacity-30"
          style={{
            background: isDark 
              ? 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.3) 50%, transparent 100%)'
              : 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.2) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
          }}
        />
      </div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
