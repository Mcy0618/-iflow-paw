import React, { useState, useCallback, memo } from 'react'
import { LightBulbIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { useTheme } from '../../hooks/useTheme'

interface ThinkingBlockProps {
  thoughts: string
  isThinking?: boolean
}

/**
 * 深度思考展示组件 - 可折叠的思考过程显示
 * 使用 memo 优化避免不必要的重渲染
 */
export const ThinkingBlock: React.FC<ThinkingBlockProps> = memo(({ thoughts, isThinking }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const { isDark } = useTheme()
  
  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])
  
  if (!thoughts) return null
  
  return (
    <div className="mb-3">
      <button
        onClick={toggleExpand}
        className={`flex items-center gap-2 text-sm transition-colors ${
          isDark 
            ? 'text-purple-400 hover:text-purple-300' 
            : 'text-purple-600 hover:text-purple-700'
        }`}
      >
        <LightBulbIcon className={`w-4 h-4 ${isThinking ? 'animate-pulse' : ''}`} />
        <span className="font-medium">
          {isThinking ? '正在深度思考...' : '深度思考过程'}
        </span>
        {isExpanded ? (
          <ChevronUpIcon className="w-4 h-4" />
        ) : (
          <ChevronDownIcon className="w-4 h-4" />
        )}
      </button>
      
      {isExpanded && (
        <div className={`mt-2 p-3 rounded-lg border text-sm animate-fade-in ${
          isDark 
            ? 'bg-gradient-to-r from-purple-950/30 to-violet-950/30 border-purple-800/50 text-slate-300' 
            : 'bg-gradient-to-r from-purple-50 to-violet-50 border-purple-100 text-slate-600'
        }`}>
          <div className="whitespace-pre-wrap leading-relaxed">
            {thoughts}
          </div>
          {isThinking && (
            <div className={`flex items-center gap-1.5 mt-2 pt-2 ${
              isDark ? 'border-t border-purple-800/50' : 'border-t border-purple-100'
            }`}>
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
              <span className={`text-xs ${isDark ? 'text-purple-400' : 'text-purple-500'}`}>
                思考中...
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

ThinkingBlock.displayName = 'ThinkingBlock'