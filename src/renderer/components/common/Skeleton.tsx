import React from 'react'
import { useTheme } from '../../hooks/useTheme'

/**
 * 骨架屏组件 - 用于加载状态占位
 * 提供更好的加载体验，减少页面抖动
 */
interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave' | 'none'
  count?: number
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse',
  count = 1
}) => {
  const { isDark } = useTheme()

  // 基础样式
  const baseClasses = 'transition-all duration-300'
  
  // 变体样式
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg',
  }

  // 动画样式
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  }

  // 背景色
  const bgClasses = isDark 
    ? 'bg-slate-700/50' 
    : 'bg-slate-200'

  // 内联样式
  const style: React.CSSProperties = {
    width: width || '100%',
    height: height || 'auto',
  }

  // 渐变背景（用于 wave 动画）
  const gradientStyle = animation === 'wave' ? {
    background: isDark
      ? 'linear-gradient(90deg, rgba(51,65,85,0.5) 25%, rgba(71,85,105,0.8) 50%, rgba(51,65,85,0.5) 75%)'
      : 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
    backgroundSize: '200% 100%',
  } : {}

  const SkeletonItem = () => (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${bgClasses} ${className}`}
      style={{ ...style, ...gradientStyle }}
      role="status"
      aria-label="加载中"
      aria-busy="true"
    />
  )

  // 如果 count > 1，返回多个骨架项
  if (count > 1) {
    return (
      <div className="space-y-2" role="status" aria-label="加载中" aria-busy="true">
        {Array.from({ length: count }).map((_, index) => (
          <SkeletonItem key={index} />
        ))}
      </div>
    )
  }

  return <SkeletonItem />
}

/**
 * 消息骨架屏组件 - 专门用于消息列表
 */
interface MessageSkeletonProps {
  isUser?: boolean
  avatar?: boolean
}

export const MessageSkeleton: React.FC<MessageSkeletonProps> = ({ isUser = false, avatar = true }) => {
  const { isDark } = useTheme()

  return (
    <div 
      className={`flex gap-3 py-4 px-6 animate-fade-in ${isUser ? 'justify-end' : 'justify-start'}`}
      role="status"
      aria-label="消息加载中"
      aria-busy="true"
    >
      {/* 头像骨架 */}
      {avatar && (
        <div className={`flex-shrink-0 ${isUser ? 'order-2' : 'order-1'}`}>
          <Skeleton 
            variant="circular" 
            width={36} 
            height={36} 
            animation="pulse"
          />
        </div>
      )}

      {/* 消息内容骨架 */}
      <div className={`max-w-[80%] ${isUser ? 'order-1' : 'order-2'}`}>
        <div className={`px-5 py-4 rounded-2xl ${
          isUser 
            ? 'bg-gradient-to-br from-primary-500/20 to-primary-600/20'
            : isDark ? 'bg-slate-800/50' : 'bg-white/50'
        }`}>
          <div className="space-y-3">
            {/* 文本骨架 */}
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="90%" />
            <Skeleton variant="text" width="95%" />
            <Skeleton variant="text" width="70%" />
          </div>
        </div>

        {/* 时间戳骨架 */}
        <div className={`flex items-center gap-2 mt-2 ${isUser ? 'justify-end mr-1' : 'ml-1'}`}>
          <Skeleton variant="text" width={60} height={12} />
        </div>
      </div>
    </div>
  )
}

/**
 * 聊天区域骨架屏组件
 */
export const ChatSkeleton: React.FC = () => {
  return (
    <div className="space-y-4" role="status" aria-label="加载聊天内容" aria-busy="true">
      {/* 用户消息骨架 */}
      <MessageSkeleton isUser={true} />
      
      {/* AI 消息骨架 */}
      <MessageSkeleton isUser={false} />
      
      {/* 用户消息骨架 */}
      <MessageSkeleton isUser={true} />
      
      {/* AI 消息骨架（加载中） */}
      <MessageSkeleton isUser={false} />
    </div>
  )
}