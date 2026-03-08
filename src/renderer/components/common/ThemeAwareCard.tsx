import React from 'react'
import { useTheme } from '../../hooks/useTheme'

interface ThemeAwareCardProps {
  children: React.ReactNode
  className?: string
  darkClassName?: string
  lightClassName?: string
}

/**
 * 主题感知卡片组件 - 自动根据主题切换样式
 */
export const ThemeAwareCard: React.FC<ThemeAwareCardProps> = ({
  children,
  className = '',
  darkClassName = 'bg-slate-800 border-slate-700',
  lightClassName = 'bg-white border-slate-200',
}) => {
  const { isDark } = useTheme()
  
  return (
    <div className={`border ${isDark ? darkClassName : lightClassName} ${className}`}>
      {children}
    </div>
  )
}
