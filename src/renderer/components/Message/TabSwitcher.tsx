import React, { memo, useCallback } from 'react'
import { LightBulbIcon } from '@heroicons/react/24/outline'
import { useTheme } from '../../hooks/useTheme'

interface TabSwitcherProps {
  activeTab: 'thinking' | 'output'
  onTabChange: (tab: 'thinking' | 'output') => void
  hasThoughts: boolean
  hasContent: boolean
  isThinking?: boolean
}

/**
 * 标签切换组件 - 用于切换思考和输出视图
 * 使用 memo 优化避免不必要的重渲染
 */
export const TabSwitcher: React.FC<TabSwitcherProps> = memo(({
  activeTab,
  onTabChange,
  hasThoughts,
  hasContent,
  isThinking,
}) => {
  const { isDark } = useTheme()
  
  // 使用 useCallback 优化回调函数
  const handleThinkingClick = useCallback(() => {
    onTabChange('thinking')
  }, [onTabChange])
  
  const handleOutputClick = useCallback(() => {
    onTabChange('output')
  }, [onTabChange])
  
  // 只有同时存在思考和输出时才显示
  if (!hasThoughts || !hasContent) return null
  
  return (
    <div className={`flex items-center gap-1 mb-3 p-1 rounded-lg relative z-10 ${
      isDark ? 'bg-slate-700/50' : 'bg-gray-100'
    }`}>
      <button
        onClick={handleThinkingClick}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
          activeTab === 'thinking'
            ? isDark
              ? 'bg-slate-600 text-purple-300 shadow-sm'
              : 'bg-white text-purple-600 shadow-sm'
            : isDark
              ? 'text-slate-400 hover:text-slate-300'
              : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <LightBulbIcon className={`w-4 h-4 ${isThinking ? 'animate-pulse' : ''}`} />
        思考过程
        {isThinking && (
          <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
        )}
      </button>
      <button
        onClick={handleOutputClick}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
          activeTab === 'output'
            ? isDark
              ? 'bg-slate-600 text-primary-300 shadow-sm'
              : 'bg-white text-primary-600 shadow-sm'
            : isDark
              ? 'text-slate-400 hover:text-slate-300'
              : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <span className="w-4 h-4 flex items-center justify-center">✓</span>
        最终输出
      </button>
    </div>
  )
})

TabSwitcher.displayName = 'TabSwitcher'