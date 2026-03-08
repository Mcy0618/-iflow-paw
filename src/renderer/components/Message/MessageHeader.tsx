import React from 'react'
import { UserIcon, CpuChipIcon } from '@heroicons/react/24/outline'
import { useTheme } from '../../hooks/useTheme'

interface MessageHeaderProps {
  role: 'user' | 'assistant'
  timestamp: number
  isStreaming?: boolean
}

/**
 * 消息头部组件 - 显示角色头像和时间戳
 */
export const MessageHeader: React.FC<MessageHeaderProps> = ({ 
  role, 
  timestamp, 
  isStreaming 
}) => {
  const isUser = role === 'user'
  const { isDark } = useTheme()
  
  // 格式化时间
  const formattedTime = new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className={`flex items-center gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* 头像 */}
      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-md ${
        isUser 
          ? 'bg-gradient-to-br from-slate-600 to-slate-700 order-2' 
          : 'bg-gradient-to-br from-primary-500 via-purple-500 to-purple-600 shadow-purple-200 dark:shadow-purple-900/30'
      }`}>
        {isUser ? (
          <UserIcon className="w-4 h-4 text-white" />
        ) : (
          <CpuChipIcon className="w-4 h-4 text-white" />
        )}
      </div>
      
      {/* 时间戳 */}
      <span className={`text-xs font-medium ${
        isDark ? 'text-slate-500' : 'text-slate-400'
      }`}>
        {formattedTime}
      </span>
      
      {/* 流式状态 */}
      {isStreaming && (
        <span className="text-xs text-primary-500 dark:text-primary-400 flex items-center gap-1.5 font-medium">
          <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse" />
          生成中
        </span>
      )}
    </div>
  )
}
