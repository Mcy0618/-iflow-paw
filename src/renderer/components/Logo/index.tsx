import React from 'react'
import { useTheme } from '../../hooks/useTheme'

interface LogoProps {
  className?: string
  size?: number
  animated?: boolean
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 32, animated = true }) => {
  const { isDark } = useTheme()

  return (
    <div className="relative inline-block">
      {/* 呼吸光效背景 */}
      {animated && (
        <div 
          className={`absolute inset-0 rounded-full blur-md ${
            isDark ? 'animate-pulse-glow-dark' : 'animate-pulse-glow'
          }`}
          style={{
            background: isDark 
              ? 'radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, transparent 70%)',
            transform: 'scale(1.2)',
          }}
        />
      )}
      
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`relative z-10 ${className}`}
      >
        {/* 外圆环 - 蓝紫色渐变 */}
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="50%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
          <linearGradient id="logoGradientAlt" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
          {/* 发光滤镜 */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* 主圆形背景 */}
        <circle 
          cx="50" 
          cy="50" 
          r="45" 
          fill="url(#logoGradient)"
          filter={animated ? 'url(#glow)' : undefined}
          className={animated ? 'animate-pulse-soft' : ''}
        />
        
        {/* 内部对话气泡形状 */}
        <path
          d="M30 40C30 34.4772 34.4772 30 40 30H60C65.5228 30 70 34.4772 70 40V55C70 60.5228 65.5228 65 60 65H55L50 72L45 65H40C34.4772 65 30 60.5228 30 55V40Z"
          fill="white"
          fillOpacity="0.95"
        />
        
        {/* 两个点代表对话 - 带动画 */}
        <circle 
          cx="42" 
          cy="47.5" 
          r="4" 
          fill="#6366F1"
          className={animated ? 'animate-bounce-soft' : ''}
          style={animated ? { animationDelay: '0s' } : undefined}
        />
        <circle 
          cx="58" 
          cy="47.5" 
          r="4" 
          fill="#6366F1"
          className={animated ? 'animate-bounce-soft' : ''}
          style={animated ? { animationDelay: '0.2s' } : undefined}
        />
      </svg>
    </div>
  )
}

export default Logo
