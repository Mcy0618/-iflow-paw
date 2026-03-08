import React from 'react'

interface StatusIndicatorProps {
  status: 'connected' | 'disconnected' | 'loading' | 'error'
  label?: string
  showPulse?: boolean
  size?: 'sm' | 'md' | 'lg'
}

/**
 * 状态指示器组件 - 统一的状态显示
 */
export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  showPulse = true,
  size = 'md',
}) => {
  const statusColors = {
    connected: 'bg-green-500',
    disconnected: 'bg-yellow-500',
    loading: 'bg-blue-500',
    error: 'bg-red-500',
  }
  
  const sizeStyles = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  }
  
  return (
    <div className="flex items-center gap-2">
      <div 
        className={`${sizeStyles[size]} ${statusColors[status]} rounded-full ${
          showPulse && (status === 'loading' || status === 'connected') ? 'animate-pulse' : ''
        }`}
      />
      {label && (
        <span className={`text-sm ${status === 'error' ? 'text-red-500' : 'text-slate-600 dark:text-slate-400'}`}>
          {label}
        </span>
      )}
    </div>
  )
}
