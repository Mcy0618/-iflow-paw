import React, { useRef, useEffect, useCallback } from 'react'
import { Session } from '../../store/useAppStore'
import { Message } from '../Message'
import { InputBox } from '../InputBox'
import { SparklesIcon } from '@heroicons/react/24/outline'

interface ChatAreaProps {
  session: Session
}

export const ChatArea: React.FC<ChatAreaProps> = ({ session }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    if (shouldAutoScrollRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  // 监听滚动事件，判断用户是否手动滚动
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
      shouldAutoScrollRef.current = isNearBottom
    }
  }, [])

  // 消息变化时自动滚动
  useEffect(() => {
    scrollToBottom()
  }, [session.messages, scrollToBottom])

  // 获取模型名称
  const getModelName = (modelId: string) => {
    const modelMap: Record<string, string> = {
      'GLM-4.7': 'GLM-4.7',
      'iFlow-ROME-30BA3B': 'iFlow-ROME',
      'DeepSeek-V3.2': 'DeepSeek-V3',
      'GLM-5': 'GLM-5',
      'Qwen3-Coder-Plus': 'Qwen3-Coder',
      'Kimi-K2-Thinking': 'Kimi-K2',
      'MiniMax-M2.5': 'MiniMax',
      'Kimi-K2.5': 'Kimi-K2.5',
      'Kimi-K2-0905': 'Kimi-K2-0905',
    }
    return modelMap[modelId] || modelId
  }

  // 获取模式名称
  const getModeName = (modeId: string) => {
    const modeMap: Record<string, string> = {
      'YOLO': 'YOLO',
      'Plan': 'Plan',
      'Smart': 'Smart',
      'Ask': 'Ask',
    }
    return modeMap[modeId] || modeId
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 顶部标题栏 */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
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
        
        <div className="flex items-center gap-3">
          {/* 深度思考指示器 */}
          {session.deepThinking && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-600 rounded-full text-xs">
              <SparklesIcon className="w-3.5 h-3.5" />
              深度思考
            </div>
          )}
          
          {/* 模式标签 */}
          <div className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
            {getModeName(session.mode)}
          </div>
          
          {/* 模型标签 */}
          <div className="px-2.5 py-1 bg-primary-50 text-primary-600 rounded-full text-xs font-medium">
            {getModelName(session.model)}
          </div>
        </div>
      </header>

      {/* 消息列表 */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-6"
      >
        {session.messages.length === 0 ? (
          // 空状态提示
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-100 to-primary-200 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-primary-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              开始新的对话
            </h3>
            <p className="text-sm text-gray-500 max-w-sm">
              在下方输入框中输入你的问题，AI 助手将为你提供帮助
            </p>
            
            {/* 快捷提示 */}
            <div className="mt-8 grid grid-cols-2 gap-3 max-w-md">
              {[
                '解释这段代码',
                '帮我优化这个函数',
                '生成测试用例',
                '代码审查',
              ].map((hint) => (
                <button
                  key={hint}
                  className="px-4 py-2.5 text-sm text-left text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        ) : (
          // 消息列表
          session.messages.map((message, index) => (
            <Message
              key={message.id}
              message={message}
              isLast={index === session.messages.length - 1}
            />
          ))
        )}
        
        {/* 滚动锚点 */}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框区域 */}
      <InputBox sessionId={session.id} />
    </div>
  )
}
