import React, { useState, useMemo, useCallback } from 'react'
import { UserIcon, CpuChipIcon, TrashIcon, ArrowPathIcon, ClipboardIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useTheme } from '../../hooks/useTheme'
import { Message as MessageType } from '../../store/useAppStore'
import { MarkdownRenderer } from './MarkdownRenderer'
import { ThinkingBlock } from './ThinkingBlock'
import { TabSwitcher } from './TabSwitcher'
import { StreamingIndicator } from './StreamingIndicator'

interface MessageProps {
  message: MessageType
  isLast?: boolean
  sessionId?: string
  onDelete?: (messageId: string) => void
  onRegenerate?: (messageId: string) => void
  isRegenerating?: boolean
  onCopy?: () => void
}

/**
 * 主消息组件 - 负责消息的整体布局和状态管理
 */
export const Message: React.FC<MessageProps> = React.memo(({ 
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

  // 用户消息 - 右侧显示
  if (isUser) {
    return (
      <div 
        className="flex justify-end animate-fade-in group"
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <div className="flex items-start gap-3 max-w-[80%]">
          <div className="flex flex-col items-end">
            <div className="px-5 py-3.5 bg-gradient-to-br from-primary-500 to-primary-600 
              text-white rounded-2xl rounded-tr-md shadow-lg shadow-primary-200 dark:shadow-primary-900/30
              relative overflow-hidden">
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
              {/* 操作按钮 */}
              {showActions && !isStreaming && (
                <div className="flex items-center gap-1">
                  {/* 复制按钮 */}
                  <button
                    onClick={handleCopy}
                    className={`p-1 rounded transition-colors ${
                      copied
                        ? 'text-green-500'
                        : isDark 
                          ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-700' 
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                    }`}
                    title={copied ? '已复制' : '复制内容'}
                  >
                    {copied ? (
                      <CheckIcon className="w-3.5 h-3.5" />
                    ) : (
                      <ClipboardIcon className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {/* 删除按钮 */}
                  {onDelete && (
                    <button
                      onClick={handleDelete}
                      className={`p-1 rounded transition-colors ${
                        isDark 
                          ? 'text-slate-500 hover:text-red-400 hover:bg-slate-700' 
                          : 'text-slate-400 hover:text-red-500 hover:bg-slate-100'
                      }`}
                      title="删除消息"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* 用户头像 */}
          <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-slate-600 to-slate-700 
            rounded-full flex items-center justify-center shadow-md">
            <UserIcon className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>
    )
  }

  // AI 消息 - 左侧显示
  return (
    <div 
      className="flex justify-start animate-fade-in group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start gap-3 max-w-[85%]">
        {/* AI 头像 */}
        <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-primary-500 via-purple-500 
          to-purple-600 rounded-full flex items-center justify-center shadow-md shadow-purple-200 dark:shadow-purple-900/30">
          <CpuChipIcon className="w-4 h-4 text-white" />
        </div>
        
        <div className="flex flex-col">
          <div className={`px-5 py-3.5 backdrop-blur-sm rounded-2xl rounded-tl-md 
            shadow-sm relative overflow-hidden ${
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
              hasContent={hasContent}
              isThinking={message.isThinking}
            />
            
            {/* 思考内容 */}
            {(activeTab === 'thinking' || !hasContent) && hasThoughts && (
              <ThinkingBlock thoughts={message.thoughts!} isThinking={message.isThinking} />
            )}
            
            {/* 输出内容 */}
            {(activeTab === 'output' || !hasThoughts) && hasContent ? (
              <div className={`markdown-content relative z-10 ${
                isDark ? 'text-slate-200' : 'text-slate-800'
              }`}>
                <MarkdownRenderer content={message.content} />
              </div>
            ) : isStreaming ? (
              <StreamingIndicator hasThoughts={hasThoughts} />
            ) : null}
          </div>
          
          <div className="flex items-center gap-2 mt-2 ml-1">
            <span className={`text-xs font-medium ${
              isDark ? 'text-slate-500' : 'text-slate-400'
            }`}>
              {formattedTime}
            </span>
            {isStreaming && (
              <span className="text-xs text-primary-500 dark:text-primary-400 flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse" />
                生成中
              </span>
            )}
            {/* 操作按钮 */}
            {!isStreaming && showActions && (
              <div className="flex items-center gap-1">
                {/* 复制按钮 */}
                <button
                  onClick={handleCopy}
                  className={`p-1 rounded transition-colors ${
                    copied
                      ? 'text-green-500'
                      : isDark 
                        ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-700' 
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  }`}
                  title={copied ? '已复制' : '复制内容'}
                >
                  {copied ? (
                    <CheckIcon className="w-3.5 h-3.5" />
                  ) : (
                    <ClipboardIcon className="w-3.5 h-3.5" />
                  )}
                </button>
                {/* 重新生成按钮 */}
                {onRegenerate && (
                  <button
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    className={`p-1 rounded transition-colors ${
                      isRegenerating 
                        ? 'text-primary-400 cursor-wait' 
                        : isDark 
                          ? 'text-slate-500 hover:text-primary-400 hover:bg-slate-700' 
                          : 'text-slate-400 hover:text-primary-500 hover:bg-slate-100'
                    }`}
                    title={isRegenerating ? '正在重新生成...' : '重新生成'}
                  >
                    <ArrowPathIcon className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                  </button>
                )}
                {/* 删除按钮 */}
                {onDelete && (
                  <button
                    onClick={handleDelete}
                    className={`p-1 rounded transition-colors ${
                      isDark 
                        ? 'text-slate-500 hover:text-red-400 hover:bg-slate-700' 
                        : 'text-slate-400 hover:text-red-500 hover:bg-slate-100'
                    }`}
                    title="删除消息"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // 自定义比较函数：只有当这些关键属性变化时才重新渲染
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.isStreaming === nextProps.message.isStreaming &&
    prevProps.message.thoughts === nextProps.message.thoughts &&
    prevProps.message.isThinking === nextProps.message.isThinking &&
    prevProps.message.timestamp === nextProps.message.timestamp &&
    prevProps.isLast === nextProps.isLast &&
    prevProps.isRegenerating === nextProps.isRegenerating &&
    prevProps.onDelete === nextProps.onDelete &&
    prevProps.onRegenerate === nextProps.onRegenerate
  )
})

// 导出子组件供外部使用
export { CodeBlock } from './CodeBlock'
export { MarkdownRenderer } from './MarkdownRenderer'
export { ThinkingBlock } from './ThinkingBlock'
export { MessageHeader } from './MessageHeader'
export { TabSwitcher } from './TabSwitcher'
export { StreamingIndicator } from './StreamingIndicator'