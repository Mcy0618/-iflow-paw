import React, { forwardRef, ButtonHTMLAttributes } from 'react'
import { useTheme } from '../../hooks/useTheme'

/**
 * 无障碍按钮组件
 * 提供完整的键盘导航、ARIA标签和屏幕阅读器支持
 */
interface AccessibleButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'ref'> {
  /** 按钮的语义标签，用于屏幕阅读器 */
  ariaLabel?: string
  /** 按钮描述，提供额外的上下文信息 */
  ariaDescription?: string
  /** 按钮状态：是否被按下 */
  pressed?: boolean
  /** 按钮状态：是否被选中 */
  selected?: boolean
  /** 按钮状态：是否被禁用（会自动添加禁用样式） */
  disabled?: boolean
  /** 按钮变体 */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  /** 按钮大小 */
  size?: 'sm' | 'md' | 'lg'
  /** 是否显示加载状态 */
  loading?: boolean
  /** 图标（React 元素） */
  icon?: React.ReactNode
  /** 子元素 */
  children?: React.ReactNode
  /** 键盘快捷键提示 */
  shortcut?: string
}

export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  ({
    ariaLabel,
    ariaDescription,
    pressed,
    selected,
    disabled = false,
    variant = 'secondary',
    size = 'md',
    loading = false,
    icon,
    children,
    shortcut,
    className = '',
    onClick,
    onKeyDown,
    ...props
  }, ref) => {
    const { isDark } = useTheme()

    // 基础样式
    const baseClasses = [
      'inline-flex',
      'items-center',
      'justify-center',
      'gap-2',
      'font-medium',
      'rounded-lg',
      'transition-all',
      'duration-200',
      'focus-visible:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-offset-2',
      'disabled:opacity-50',
      'disabled:cursor-not-allowed',
      'disabled:pointer-events-none',
    ]

    // 变体样式
    const variantClasses = {
      primary: [
        'bg-gradient-to-r',
        'from-primary-500',
        'to-purple-500',
        'text-white',
        'shadow-md',
        'hover:shadow-lg',
        'hover:from-primary-600',
        'hover:to-purple-600',
        'focus-visible:ring-primary-500',
        isDark ? 'focus-visible:ring-offset-slate-900' : 'focus-visible:ring-offset-white',
      ],
      secondary: [
        isDark ? 'bg-slate-700' : 'bg-slate-100',
        isDark ? 'text-slate-200' : 'text-slate-700',
        isDark ? 'hover:bg-slate-600' : 'hover:bg-slate-200',
        'border',
        isDark ? 'border-slate-600' : 'border-slate-200',
        'focus-visible:ring-slate-500',
        isDark ? 'focus-visible:ring-offset-slate-900' : 'focus-visible:ring-offset-white',
      ],
      ghost: [
        'transparent',
        isDark ? 'text-slate-300' : 'text-slate-600',
        isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100',
        'focus-visible:ring-slate-500',
        isDark ? 'focus-visible:ring-offset-slate-900' : 'focus-visible:ring-offset-white',
      ],
      danger: [
        'bg-red-500',
        'text-white',
        'shadow-md',
        'hover:bg-red-600',
        'focus-visible:ring-red-500',
        isDark ? 'focus-visible:ring-offset-slate-900' : 'focus-visible:ring-offset-white',
      ],
    }

    // 大小样式
    const sizeClasses = {
      sm: ['px-3', 'py-1.5', 'text-sm', 'rounded-md'],
      md: ['px-4', 'py-2', 'text-base', 'rounded-lg'],
      lg: ['px-6', 'py-3', 'text-lg', 'rounded-xl'],
    }

    // 加载动画
    const loadingSpinner = (
      <svg
        className="animate-spin h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        role="status"
        aria-label="加载中"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    )

    // 处理键盘事件
    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      // 支持 Enter 和 Space 键激活按钮
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (!disabled && !loading) {
          onClick?.(e as any)
        }
      }
      
      onKeyDown?.(e)
    }

    // 构建完整的 className
    const buttonClasses = [
      ...baseClasses,
      ...variantClasses[variant],
      ...sizeClasses[size],
      className,
    ].filter(Boolean).join(' ')

    return (
      <button
        ref={ref}
        className={buttonClasses}
        disabled={disabled || loading}
        aria-label={ariaLabel}
        aria-describedby={ariaDescription ? `${ariaLabel}-desc` : undefined}
        aria-pressed={pressed}
        aria-selected={selected}
        aria-busy={loading}
        aria-disabled={disabled || loading}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        type="button"
        {...props}
      >
        {/* 加载状态 */}
        {loading && loadingSpinner}
        
        {/* 图标 */}
        {!loading && icon && (
          <span className="flex-shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
        
        {/* 子元素 */}
        {children && (
          <span className="flex-shrink-0">
            {children}
          </span>
        )}
        
        {/* 快捷键提示 */}
        {shortcut && !loading && (
          <span 
            className={`ml-2 px-1.5 py-0.5 text-xs rounded ${
              isDark 
                ? 'bg-slate-600 text-slate-400' 
                : 'bg-slate-200 text-slate-500'
            }`}
            aria-hidden="true"
          >
            {shortcut}
          </span>
        )}
        
        {/* ARIA 描述 */}
        {ariaDescription && (
          <span 
            id={`${ariaLabel}-desc`} 
            className="sr-only"
          >
            {ariaDescription}
          </span>
        )}
      </button>
    )
  }
)

AccessibleButton.displayName = 'AccessibleButton'

/**
 * 无障碍图标按钮组件
 * 专门用于只有图标的按钮，确保屏幕阅读器能正确识别
 */
interface AccessibleIconButtonProps {
  /** 图标（React 元素） */
  icon: React.ReactNode
  /** ARIA 标签（必需） */
  ariaLabel: string
  /** 按钮状态：是否被禁用 */
  disabled?: boolean
  /** 是否显示加载状态 */
  loading?: boolean
  /** 按钮变体 */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  /** 按钮大小 */
  size?: 'sm' | 'md' | 'lg'
  /** 点击处理 */
  onClick?: () => void
  /** 键盘快捷键提示 */
  shortcut?: string
  /** 额外的 className */
  className?: string
}

export const AccessibleIconButton: React.FC<AccessibleIconButtonProps> = ({
  icon,
  ariaLabel,
  disabled = false,
  loading = false,
  variant = 'ghost',
  size = 'md',
  onClick,
  shortcut,
  className = '',
}) => {
  return (
    <AccessibleButton
      ariaLabel={ariaLabel}
      icon={icon}
      disabled={disabled}
      loading={loading}
      variant={variant}
      size={size}
      onClick={onClick}
      shortcut={shortcut}
      className={className}
    />
  )
}