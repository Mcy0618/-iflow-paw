import React, { useEffect, useState } from 'react'
import { useTheme } from '../../hooks/useTheme'

/**
 * 流式输出光标组件
 * 提供更流畅的打字机效果和视觉反馈
 */
interface StreamingCursorProps {
  /** 光标大小 */
  size?: 'sm' | 'md' | 'lg'
  /** 自定义样式 */
  className?: string
  /** 是否显示 */
  visible?: boolean
  /** 动画速度（毫秒） */
  speed?: number
}

export const StreamingCursor: React.FC<StreamingCursorProps> = ({
  size = 'md',
  className = '',
  visible = true,
  speed = 500,
}) => {
  const { isDark } = useTheme()
  const [isActive, setIsActive] = useState(true)

  // 光标闪烁效果
  useEffect(() => {
    if (!visible) return
    
    const interval = setInterval(() => {
      setIsActive(prev => !prev)
    }, speed)

    return () => clearInterval(interval)
  }, [visible, speed])

  // 大小样式
  const sizeClasses = {
    sm: 'w-1.5 h-4',
    md: 'w-2 h-5',
    lg: 'w-2.5 h-6',
  }

  // 颜色样式
  const colorClasses = isDark
    ? 'bg-primary-400'
    : 'bg-primary-600'

  if (!visible) return null

  return (
    <span
      className={`inline-block align-middle ${sizeClasses[size]} ${colorClasses} ${
        isActive ? 'opacity-100' : 'opacity-0'
      } transition-opacity duration-200 ${className}`}
      role="status"
      aria-label="正在输入"
      aria-hidden="true"
    />
  )
}

/**
 * 流式输出指示器组件
 * 显示在消息末尾，表示正在生成内容
 */
interface StreamingIndicatorProps {
  /** 指示器类型 */
  type?: 'dots' | 'cursor' | 'typing'
  /** 自定义文本 */
  text?: string
  /** 是否显示 */
  visible?: boolean
  /** 自定义样式 */
  className?: string
}

export const StreamingIndicator: React.FC<StreamingIndicatorProps> = ({
  type = 'typing',
  text,
  visible = true,
  className = '',
}) => {
  const { isDark } = useTheme()

  if (!visible) return null

  // 圆点动画指示器
  if (type === 'dots') {
    return (
      <span 
        className={`inline-flex items-center gap-1 ${className}`}
        role="status"
        aria-label="正在生成"
        aria-live="polite"
      >
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={`w-1.5 h-1.5 rounded-full ${
              isDark ? 'bg-primary-400' : 'bg-primary-600'
            } animate-bounce`}
            style={{
              animationDelay: `${index * 150}ms`,
              animationDuration: '1s',
            }}
            aria-hidden="true"
          />
        ))}
        {text && (
          <span className={`ml-2 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {text}
          </span>
        )}
      </span>
    )
  }

  // 打字机指示器
  if (type === 'typing') {
    return (
      <span 
        className={`inline-flex items-center gap-2 ${className}`}
        role="status"
        aria-label="正在输入"
        aria-live="polite"
      >
        <StreamingCursor size="md" />
        {text && (
          <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {text}
          </span>
        )}
      </span>
    )
  }

  // 默认光标
  return (
    <span 
      className={`inline-flex items-center ${className}`}
      role="status"
      aria-label="正在生成"
      aria-live="polite"
    >
      <StreamingCursor size="md" />
      {text && (
        <span className={`ml-2 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {text}
        </span>
      )}
    </span>
  )
}

/**
 * 打字机效果组件
 * 逐字显示文本内容
 */
interface TypewriterProps {
  /** 要显示的文本 */
  text: string
  /** 打字速度（毫秒/字符） */
  speed?: number
  /** 是否启用打字效果 */
  enabled?: boolean
  /** 打字完成回调 */
  onComplete?: () => void
  /** 自定义样式 */
  className?: string
}

export const Typewriter: React.FC<TypewriterProps> = ({
  text,
  speed = 30,
  enabled = true,
  onComplete,
  className = '',
}) => {
  const [displayText, setDisplayText] = useState('')
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setDisplayText(text)
      setIsComplete(true)
      return
    }

    setDisplayText('')
    setIsComplete(false)

    let currentIndex = 0
    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayText(prev => prev + text[currentIndex])
        currentIndex++
      } else {
        setIsComplete(true)
        clearInterval(interval)
        onComplete?.()
      }
    }, speed)

    return () => clearInterval(interval)
  }, [text, speed, enabled, onComplete])

  return (
    <span className={className}>
      {displayText}
      {!isComplete && <StreamingCursor size="md" />}
    </span>
  )
}