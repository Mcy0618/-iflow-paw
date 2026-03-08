import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { UserIcon, CpuChipIcon, TrashIcon, ArrowPathIcon, ClipboardIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useTheme } from '../../hooks/useTheme'
import { Message as MessageType } from '../../store/useAppStore'
import { MarkdownRenderer } from './MarkdownRenderer'
import { ThinkingBlock } from './ThinkingBlock'
import { TabSwitcher } from './TabSwitcher'
import { StreamingIndicator } from '../common/StreamingCursor'
import { AccessibleIconButton } from '../common/AccessibleButton'

interface MessageWithA11yProps {
  message: MessageType
  isLast?: boolean
  sessionId?: string
  onDelete?: (messageId: string) => void
  onRegenerate?: (messageId: string) => void
  isRegenerating?: boolean
  onCopy?: () => void
}

/**
 * 无障碍增强的消息组件
 * 提供完整的键盘导航、ARIA标签和屏幕阅读器支持
 */
export const MessageWithA11y: React.FC<MessageWithA11yProps> = React.memo(({ 
  message, 
  isLast: _isLast,
  sessionId: _sessionId,
  onDelete,
  onRegenerate,
  isRegenerating = false,
  onCopy
}) => {
  const isUser = message.role === 'user'
  const isStreaming = message.isStreaming
  const hasThoughts = !!message.thoughts
  const hasContent = !!message.content
  const { isDark } = useTheme()
  const messageRef = useRef<HTMLDivElement>(null)
  
  // 标签切换状态：默认显示输出
  const [activeTab, setActiveTab] = useState<'thinking' | 'output'>('thinking')
  
  // 操作按钮显示状态
  const [showActions, setShowActions] = useState(false)
  
  // 复制状态
  const [copied, setCopied] = useState(false)
  
  // 格式化时间
  const formattedTime = useMemo(() => {
    return new Date(message.timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [message.timestamp])
  
  // 处理复制
  const handleCopy = useCallback(async () => {
    const contentToCopy = message.thoughts 
      ? `【思考过程】\n${message.thoughts}\n\n【回复内容】\n${message.content}`
      : message.content
    
    try {
      await navigator.clipboard.writeText(contentToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      if (onCopy) onCopy()
    } catch (err) {
      console.error('Failed to copy message:', err)
    }
  }, [message.content, message.thoughts, onCopy])
  
  // 处理删除
  const handleDelete = useCallback(() => {
    if (onDelete && !isStreaming) {
      onDelete(message.id)
    }
  }, [message.id, onDelete, isStreaming])
  
  // 处理重新生成
  const handleRegenerate = useCallback(() => {
    if (onRegenerate && !isStreaming && !isRegenerating) {
      onRegenerate(message.id)
    }
  }, [message.id, onRegenerate, isStreaming, isRegenerating])

  // 键盘导航支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc 键隐藏操作按钮
      if (e.key === 'Escape' && showActions) {
        setShowActions(false)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showActions])

  // ARIA 属性
  const ariaProps = {
    role: 'article',
    'aria-label': isUser ? '用户消息' : 'AI 消息',
    'aria-live': isStreaming ? 'polite' : 'off',
    'aria-busy': isStreaming,
    'tabIndex': 0,
  }

  // 用户消息 - 右侧显示
  if (isUser) {
    return (
      <div 
        ref={messageRef}
        className={`flex justify-end animate-fade-in group ${showActions ? 'focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2 rounded-2xl' : ''}`}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        onFocus={() => setShowActions(true)}
        onBlur={(e) => {
          // 只有当焦点完全离开消息时才隐藏按钮
          if (!messageRef.current?.contains(e.relatedTarget as Node)) {
            setShowActions(false)
          }
        }}
        {...ariaProps}
      >
        <div className="flex items-start gap-3 max-w-[80%]">
          <div className="flex flex-col items-end">
            <div className="px-5 py-3.5 bg-gradient-to-br from-primary-500 to-primary-600 
              text-white rounded-2xl rounded-tr-md shadow-lg shadow-primary-200 dark:shadow-primary-900/30
              relative overflow-hidden message-shimmer">
              {/* 边框光效 */}
              <div className="absolute inset-0 rounded-2xl rounded-tr-md opacity-50 pointer-events-none"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%, rgba(255,255,255,0.1) 100%)',
                }}
              />
              <div className="whitespace-pre-wrap leading-relaxed text-[15px] relative z-10">
                {message.content}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 mr-1">
              <span className={`text-xs font-medium ${
                isDark ? 'text-slate-500' : 'text-slate-400'
              }`}>
                {formattedTime}
              </span>
              {/* 操作按钮 - 使用无障碍组件 */}
              <div 
                className={`flex items-center gap-1 transition-opacity duration-200 ${showActions ? 'opacity-100' : 'opacity-0'}`}
                role="toolbar"
                aria-label="消息操作"
              >
                {/* 复制按钮 */}
                <AccessibleIconButton
                  icon={copied ? <CheckIcon className="w-3.5 h-3.5" /> : <ClipboardIcon className="w-3.5 h-3.5" />}
                  ariaLabel={copied ? '已复制' : '复制内容'}
                  onClick={handleCopy}
                  size="sm"
                  variant="ghost"
                />
                
                {/* 删除按钮 */}
                {onDelete && (
                  <AccessibleIconButton
                    icon={<TrashIcon className="w-3.5 h-3.5" />}
                    ariaLabel="删除消息"
                    onClick={handleDelete}
                    size="sm"
                    variant="ghost"
                    disabled={isStreaming}
                  />
                )}
              </div>
            </div>
          </div>
          
          {/* 用户头像 */}
          <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-slate-600 to-slate-700 
            rounded-full flex items-center justify-center shadow-md" 
            role="img"
            aria-label="用户头像">
            <UserIcon className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>
    )
  }

  // AI 消息 - 左侧显示
  return (
    <div 
      ref={messageRef}
      className={`flex justify-start animate-fade-in group ${showActions ? 'focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2 rounded-2xl' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onFocus={() => setShowActions(true)}
      onBlur={(e) => {
        if (!messageRef.current?.contains(e.relatedTarget as Node)) {
          setShowActions(false)
        }
      }}
      {...ariaProps}
    >
      <div className="flex items-start gap-3 max-w-[85%]">
        {/* AI 头像 */}
        <div 
          className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-primary-500 via-purple-500 
          to-purple-600 rounded-full flex items-center justify-center shadow-md shadow-purple-200 dark:shadow-purple-900/30"
          role="img"
          aria-label="AI 助手头像"
        >
          <CpuChipIcon className="w-4 h-4 text-white" />
        </div>
        
        <div className="flex flex-col">
          <div className={`px-5 py-3.5 backdrop-blur-sm rounded-2xl rounded-tl-md 
            shadow-sm relative overflow-hidden message-shimmer ${
            isDark 
              ? 'bg-slate-800/90 border border-slate-700/50 shadow-slate-900/20' 
              : 'bg-white/90 border border-slate-200/60 shadow-slate-200/50'
          }`}>
            {/* 边框光效动画 */}
            <div className="absolute inset-0 rounded-2xl rounded-tl-md pointer-events-none overflow-hidden">
              <div className="absolute inset-0 animate-shimmer opacity-30"
                style={{
                  background: isDark 
                    ? 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.3) 50%, transparent 100%)'
                    : 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.2) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                }}
              />
            </div>
            
            {/* 标签切换 */}
            <TabSwitcher
              activeTab={activeTab}
              onTabChange={setActiveTab}
              hasThoughts={hasThoughts}
            />
            
            {/* 内容区域 */}
            <div className="relative z-10 min-h-[20px]">
              {/* 思考过程 */}
              {hasThoughts && activeTab === 'thinking' && (
                <ThinkingBlock thoughts={message.thoughts || ''} />
              )}
              
              {/* 回复内容 */}
              {activeTab === 'output' && (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {hasContent ? (
                    <MarkdownRenderer content={message.content} />
                  ) : (
                    <div className="text-slate-400 text-sm">等待生成...</div>
                  )}
                  
                  {/* 流式输出指示器 */}
                  {isStreaming && isLast && (
                    <StreamingIndicator 
                      type="cursor" 
                      text="" 
                      visible 
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 操作栏 */}
          <div className="flex items-center gap-2 mt-2 ml-1">
            <span className={`text-xs font-medium ${
              isDark ? 'text-slate-500' : 'text-slate-400'
            }`}>
              {formattedTime}
            </span>
            
            {/* 操作按钮 - 使用无障碍组件 */}
            <div 
              className={`flex items-center gap-1 transition-opacity duration-200 ${showActions ? 'opacity-100' : 'opacity-0'}`}
              role="toolbar"
              aria-label="消息操作"
            >
              {/* 复制按钮 */}
              <AccessibleIconButton
                icon={copied ? <CheckIcon className="w-3.5 h-3.5" /> : <ClipboardIcon className="w-3.5 h-3.5" />}
                ariaLabel={copied ? '已复制' : '复制内容'}
                onClick={handleCopy}
                size="sm"
                variant="ghost"
              />
              
              {/* 重新生成按钮 */}
              {onRegenerate && (
                <AccessibleIconButton
                  icon={<ArrowPathIcon className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />}
                  ariaLabel={isRegenerating ? '正在重新生成' : '重新生成'}
                  onClick={handleRegenerate}
                  size="sm"
                  variant="ghost"
                  disabled={isStreaming || isRegenerating}
                  loading={isRegenerating}
                />
              )}
              
              {/* 删除按钮 */}
              {onDelete && (
                <AccessibleIconButton
                  icon={<TrashIcon className="w-3.5 h-3.5" />}
                  ariaLabel="删除消息"
                  onClick={handleDelete}
                  size="sm"
                  variant="ghost"
                  disabled={isStreaming}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

MessageWithA11y.displayName = 'MessageWithA11y'
