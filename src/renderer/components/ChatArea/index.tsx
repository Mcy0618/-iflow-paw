import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Session, Message as MessageType, useAppStore } from '../../store/useAppStore'
import { Message } from '../Message'
import { InputBox } from '../InputBox'
import { SparklesIcon } from '@heroicons/react/24/outline'
import { Logo } from '../Logo'
import { ChatSkeleton } from '../common/Skeleton'
import { StreamingIndicator } from '../common/StreamingCursor'
import { useRecommendations } from '../../hooks/useRecommendations'

interface ChatAreaProps {
  session: Session
  onRegenerateMessage?: (sessionId: string, messageId: string) => Promise<void>
}

// 消息项组件 - 用于虚拟列表
interface MessageItemProps {
  message: MessageType
  isLast: boolean
  sessionId: string
  onDelete: (messageId: string) => void
  onRegenerate: (messageId: string) => void
  isRegenerating: boolean
  onCopy: () => void
}

const MessageItem = React.memo<MessageItemProps>(({ 
  message, 
  isLast, 
  sessionId, 
  onDelete, 
  onRegenerate,
  isRegenerating,
  onCopy
}) => {
  return (
    <Message 
      message={message} 
      isLast={isLast} 
      sessionId={sessionId}
      onDelete={onDelete}
      onRegenerate={onRegenerate}
      isRegenerating={isRegenerating}
      onCopy={onCopy}
    />
  )
})

MessageItem.displayName = 'MessageItem'

export const ChatArea: React.FC<ChatAreaProps> = ({ session, onRegenerateMessage }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)
  const prevMessagesLengthRef = useRef(0)
  
  // 从 store 获取删除消息方法和 Toast
  const deleteMessage = useAppStore((state) => state.deleteMessage)
  const addToast = useAppStore((state) => state.addToast)
  const isStreaming = useAppStore((state) => state.isStreaming)
  
  // 重新生成状态
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null)
  
  // 删除消息处理
  const handleDeleteMessage = useCallback((messageId: string) => {
    deleteMessage(session.id, messageId)
    addToast({ type: 'success', message: '消息已删除', duration: 2000 })
  }, [session.id, deleteMessage, addToast])
  
  // 重新生成消息处理
  const handleRegenerateMessage = useCallback(async (messageId: string) => {
    if (regeneratingMessageId || !onRegenerateMessage) return
    
    setRegeneratingMessageId(messageId)
    try {
      await onRegenerateMessage(session.id, messageId)
      addToast({ type: 'success', message: '已重新生成', duration: 2000 })
    } catch (error) {
      addToast({ type: 'error', message: '重新生成失败', duration: 3000 })
    } finally {
      setRegeneratingMessageId(null)
    }
  }, [session.id, regeneratingMessageId, onRegenerateMessage, addToast])
  
  // 复制消息处理
  const handleCopyMessage = useCallback(() => {
    addToast({ type: 'success', message: '已复制到剪贴板', duration: 2000 })
  }, [addToast])

  // 虚拟列表配置 - 动态高度估算
  const virtualizer = useVirtualizer({
    count: session.messages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: useCallback((index: number) => {
      // 基于消息内容长度动态估算高度
      const message = session.messages[index]
      if (!message) return 140
      
      const contentLength = message.content?.length || 0
      const thoughtsLength = message.thoughts?.length || 0
      
      // 基础高度：头像、间距、内边距、边距等（增加基础高度避免重叠）
      const baseHeight = 100
      
      // 内容高度：每 80 个字符大约需要 22px 高度（更精确的估算）
      const contentHeight = Math.ceil(contentLength / 80) * 22
      
      // 思考内容高度：每 80 个字符大约需要 22px 高度
      const thoughtsHeight = message.thoughts ? Math.ceil(thoughtsLength / 80) * 22 : 0
      
      // 代码块额外高度（增加估算）
      const codeBlockCount = (message.content?.match(/```/g) || []).length / 2
      const codeBlockHeight = codeBlockCount * 60
      
      // 附件额外高度
      const attachmentHeight = (message.attachments?.length || 0) * 80
      
      // 总高度（限制最大 800px，避免单个消息占用过多空间）
      const totalHeight = Math.min(baseHeight + contentHeight + thoughtsHeight + codeBlockHeight + attachmentHeight, 800)
      
      return Math.max(totalHeight, 140) // 最小高度 140px（增加最小高度）
    }, [session.messages]),
    overscan: 8, // 增加预渲染的额外项目数，减少滚动时的空白和重叠
    measureElement: (element) => {
      // 实际测量元素高度，包含 margin
      if (!element) return 140
      const rect = element.getBoundingClientRect()
      // 读取计算后的高度，包含 padding 和 border
      const computedHeight = window.getComputedStyle(element)
      const marginTop = parseFloat(computedHeight.marginTop) || 0
      const marginBottom = parseFloat(computedHeight.marginBottom) || 0
      return Math.max(rect.height + marginTop + marginBottom, 140)
    },
    // 启用动态测量，当内容变化时自动重新测量
    measureElementOptions: {
      pointerEvents: 'none' // 测量时禁用指针事件避免干扰
    }
  })

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    if (shouldAutoScrollRef.current && containerRef.current) {
      const lastItemIndex = session.messages.length - 1
      virtualizer.scrollToIndex(lastItemIndex, { align: 'end', behavior: 'smooth' })
    }
  }, [session.messages.length, virtualizer])

  // 监听滚动事件，判断用户是否手动滚动
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
      shouldAutoScrollRef.current = isNearBottom
    }
  }, [])

  // 新消息时自动滚动
  useEffect(() => {
    const currentLength = session.messages.length
    const prevLength = prevMessagesLengthRef.current
    
    // 只在消息数量增加时滚动（新消息）
    if (currentLength > prevLength) {
      // 使用 requestAnimationFrame 确保 DOM 更新后再滚动
      requestAnimationFrame(() => {
        scrollToBottom()
      })
    }
    
    prevMessagesLengthRef.current = currentLength
  }, [session.messages.length, scrollToBottom])

  // 获取模型名称 - 使用 useMemo 缓存
  const modelMap = useMemo(() => ({
    'GLM-4.7': 'GLM-4.7',
    'iFlow-ROME-30BA3B': 'iFlow-ROME',
    'DeepSeek-V3.2': 'DeepSeek-V3',
    'GLM-5': 'GLM-5',
    'Qwen3-Coder-Plus': 'Qwen3-Coder',
    'Kimi-K2-Thinking': 'Kimi-K2',
    'MiniMax-M2.5': 'MiniMax',
    'Kimi-K2.5': 'Kimi-K2.5',
    'Kimi-K2-0905': 'Kimi-K2-0905',
  }), [])

  const getModelName = useCallback((modelId: string) => {
    return modelMap[modelId as keyof typeof modelMap] || modelId
  }, [modelMap])

  // 获取模式名称 - 使用 useMemo 缓存
  const modeMap = useMemo(() => ({
    'YOLO': 'YOLO',
    'Plan': 'Plan',
    'Smart': 'Smart',
    'Ask': 'Ask',
  }), [])

  const getModeName = useCallback((modeId: string) => {
    return modeMap[modeId as keyof typeof modeMap] || modeId
  }, [modeMap])

  // 智能推荐的快捷操作
  const { recommendedActions } = useRecommendations()

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 顶部标题栏 */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900">
            {session.title}
          </h2>
          {session.messages.length === 0 && (
            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">
              新会话
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* 工作区显示 */}
          {session.workingDir && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-xs font-semibold" title={session.workingDir}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className="max-w-[120px] truncate">{session.workingDir.split(/[\\/]/).pop()}</span>
            </div>
          )}
          
          {/* 深度思考指示器 */}
          {session.deepThinking && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-50 to-violet-50 text-purple-700 rounded-full text-xs font-semibold shadow-sm">
              <SparklesIcon className="w-3.5 h-3.5 animate-pulse-soft" />
              深度思考
            </div>
          )}
          
          {/* 模式标签 */}
          <div className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">
            {getModeName(session.mode)}
          </div>
          
          {/* 模型标签 */}
          <div className="px-3 py-1.5 bg-gradient-to-r from-primary-50 to-indigo-50 text-primary-700 rounded-full text-xs font-semibold">
            {getModelName(session.model)}
          </div>
        </div>
      </header>

      {/* 消息列表 */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6 pb-24 smooth-scroll"
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-label="聊天消息列表"
      >
        {session.messages.length === 0 ? (
          // 空状态提示 - 改进的无障碍支持
          <div 
            className="flex flex-col items-center justify-center h-full text-center animate-fade-in"
            role="status"
            aria-label="暂无消息"
          >
            <div className="relative mb-8" role="img" aria-label="iFlow Logo">
              <div className="w-24 h-24 bg-gradient-to-br from-primary-100 via-purple-100 to-primary-200 rounded-3xl flex items-center justify-center shadow-soft-lg animate-float">
                <Logo size={64} />
              </div>
              <div className="absolute -inset-4 bg-gradient-to-r from-primary-500/20 to-purple-500/20 blur-3xl rounded-full animate-pulse-soft" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 mb-3 animate-slide-up">
              开始新的对话
            </h2>
            <p className="text-base text-slate-500 max-w-md mb-2 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              在下方输入框中输入你的问题，AI 助手将为你提供帮助
            </p>
            
            {/* 快捷提示 - 智能推荐，改进的可访问性 */}
            <div className="mt-10 w-full max-w-lg animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <p className="text-sm text-slate-400 mb-4 font-medium">试试这些提示：</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recommendedActions.map((action, index) => (
                  <button
                    key={index}
                    className="px-5 py-4 text-sm text-left text-slate-600 bg-white hover:bg-slate-50 rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-primary-200 hover:text-primary-700 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                    onClick={() => {
                      // 自动填充提示文本到输入框
                      const textarea = document.querySelector('textarea') as HTMLTextAreaElement
                      if (textarea) {
                        textarea.value = action
                        textarea.focus()
                        // 触发 input 事件以更新状态
                        const event = new Event('input', { bubbles: true })
                        textarea.dispatchEvent(event)
                      }
                    }}
                    aria-label={`使用提示：${action}`}
                  >
                    <span className="group-hover:translate-x-1 inline-block transition-transform duration-200">
                      💡 {action}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 键盘快捷键提示 */}
            <div className="mt-8 text-xs text-slate-400 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <kbd className="px-2 py-1 bg-slate-100 rounded text-slate-500 font-mono">
                Enter
              </kbd> 发送 ·
              <kbd className="px-2 py-1 bg-slate-100 rounded text-slate-500 font-mono">
                Shift + Enter
              </kbd> 换行
            </div>
          </div>
        ) : (
          // 虚拟列表
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const message = session.messages[virtualItem.index]
              const isLast = virtualItem.index === session.messages.length - 1
              
              return (
                <div
                  key={message.id}
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    minHeight: '140px', // 确保最小高度
                    transform: `translateY(${virtualItem.start}px)`,
                    padding: '0.75rem 0',
                    boxSizing: 'border-box',
                  }}
                >
                  <MessageItem
                    message={message}
                    isLast={isLast}
                    sessionId={session.id}
                    onDelete={handleDeleteMessage}
                    onRegenerate={handleRegenerateMessage}
                    isRegenerating={regeneratingMessageId === message.id}
                    onCopy={handleCopyMessage}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 输入框区域 */}
      <InputBox />
    </div>
  )
}