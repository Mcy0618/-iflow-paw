import React, { memo } from 'react'
import { useTheme } from '../../hooks/useTheme'

interface StreamingIndicatorProps {
  hasThoughts?: boolean
}

/**
 * 流式加载指示器 - 显示 AI 正在生成内容
 * 使用 memo 优化避免不必要的重渲染
 */
export const StreamingIndicator: React.FC<StreamingIndicatorProps> = memo(({ hasThoughts }) => {
  const { isDark } = useTheme()
  
  return (
    <div className="flex items-center gap-1.5 py-2">
      <span 
        className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" 
        style={{ animationDelay: '0ms', animationDuration: '0.6s' }} 
      />
      <span 
        className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" 
        style={{ animationDelay: '150ms', animationDuration: '0.6s' }} 
      />
      <span 
        className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" 
        style={{ animationDelay: '300ms', animationDuration: '0.6s' }} 
      />
      <span className={`ml-2 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {hasThoughts ? '正在生成回答...' : 'AI 正在思考...'}
      </span>
    </div>
  )
})

StreamingIndicator.displayName = 'StreamingIndicator'