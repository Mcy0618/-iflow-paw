import React, { useState, useRef, useCallback, useEffect } from 'react'
import { 
  PaperAirplaneIcon, 
  FolderIcon,
  LightBulbIcon,
  SparklesIcon,
  ChevronDownIcon,
  CommandLineIcon
} from '@heroicons/react/24/outline'
import { Listbox, Switch } from '@headlessui/react'
import { useAcp, MODELS, MODES, ModelId, ModeId } from '../../hooks/useAcp'
import { useSessions } from '../../hooks/useSessions'
import { useAppStore } from '../../store/useAppStore'

interface InputBoxProps {
  sessionId: string
}

// 模型选择器
interface ModelSelectorProps {
  value: string
  onChange: (value: string) => void
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ value, onChange }) => {
  const selectedModel = MODELS.find(m => m.id === value) || MODELS[0]

  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative">
        <Listbox.Button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
          <CommandLineIcon className="w-3.5 h-3.5" />
          <span className="max-w-[100px] truncate">{selectedModel.name}</span>
          <ChevronDownIcon className="w-3 h-3 text-gray-400" />
        </Listbox.Button>

        <Listbox.Options className="absolute bottom-full left-0 mb-1 w-56 max-h-60 overflow-auto bg-white rounded-lg shadow-lg border border-gray-200 py-1 focus:outline-none z-50">
          {MODELS.map((model) => (
            <Listbox.Option
              key={model.id}
              value={model.id}
              className={({ active, selected }) => {
                const isSelected = selected
                return `
                  relative cursor-pointer select-none py-2 px-3 text-sm
                  ${active ? 'bg-primary-50 text-primary-900' : 'text-gray-900'}
                  ${isSelected ? 'bg-primary-50' : ''}
                `
              }}
            >
              {({ selected }) => {
                const isSelected = selected
                return (
                  <div className="flex items-center justify-between">
                    <span className={`block truncate ${isSelected ? 'font-medium' : 'font-normal'}`}>
                      {model.name}
                    </span>
                    {isSelected && (
                      <span className="text-primary-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </div>
                )
              }}
            </Listbox.Option>
          ))}
        </Listbox.Options>
      </div>
    </Listbox>
  )
}

// 模式选择器
interface ModeSelectorProps {
  value: string
  onChange: (value: string) => void
}

const ModeSelector: React.FC<ModeSelectorProps> = ({ value, onChange }) => {
  const selectedMode = MODES.find(m => m.id === value) || MODES[2]

  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative">
        <Listbox.Button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
          <LightBulbIcon className="w-3.5 h-3.5" />
          <span>{selectedMode.name}</span>
          <ChevronDownIcon className="w-3 h-3 text-gray-400" />
        </Listbox.Button>

        <Listbox.Options className="absolute bottom-full left-0 mb-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 focus:outline-none z-50">
          {MODES.map((mode) => (
            <Listbox.Option
              key={mode.id}
              value={mode.id}
              className={({ active, selected }) => {
                const isSelected = selected
                return `
                  relative cursor-pointer select-none py-2 px-3 text-sm
                  ${active ? 'bg-primary-50 text-primary-900' : 'text-gray-900'}
                  ${isSelected ? 'bg-primary-50' : ''}
                `
              }}
            >
              {({ selected }) => {
                const isSelected = selected
                return (
                  <div className="flex flex-col">
                    <span className={`block ${isSelected ? 'font-medium' : 'font-normal'}`}>
                      {mode.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {mode.desc}
                    </span>
                  </div>
                )
              }}
            </Listbox.Option>
          ))}
        </Listbox.Options>
      </div>
    </Listbox>
  )
}

// 深度思考开关
interface DeepThinkingToggleProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
}

const DeepThinkingToggle: React.FC<DeepThinkingToggleProps> = ({ enabled, onChange }) => {
  return (
    <Switch
      checked={enabled}
      onChange={onChange}
      className={`
        flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors
        ${enabled 
          ? 'bg-purple-100 text-purple-700' 
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }
      `}
    >
      <SparklesIcon className={`w-3.5 h-3.5 ${enabled ? 'text-purple-600' : ''}`} />
      <span>深度思考</span>
    </Switch>
  )
}

// 工作区选择器
interface WorkspaceSelectorProps {
  path: string
  onChange: (path: string) => void
}

const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({ path, onChange }) => {
  const handleSelect = async () => {
    if (window.electronAPI?.selectFolder) {
      const result = await window.electronAPI.selectFolder()
      if (result) {
        onChange(result)
      }
    }
  }

  return (
    <button
      onClick={handleSelect}
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors max-w-[200px]"
      title={path || '选择工作区'}
    >
      <FolderIcon className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="truncate">
        {path ? path.split(/[/\\]/).pop() : '选择工作区'}
      </span>
    </button>
  )
}

// 主组件
export const InputBox: React.FC<InputBoxProps> = ({ sessionId }) => {
  const [content, setContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const { 
    sendMessage, 
    currentModel, 
    currentMode, 
    deepThinking,
    setModel, 
    setMode, 
    setDeepThinking,
    isConnected 
  } = useAcp()
  
  const { updateSessionSettings, generateSessionTitle } = useSessions()
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)

  // 自动调整 textarea 高度
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const newHeight = Math.min(textarea.scrollHeight, 200)
      textarea.style.height = `${newHeight}px`
    }
  }, [])

  // 内容变化时调整高度
  useEffect(() => {
    adjustHeight()
  }, [content, adjustHeight])

  // 处理发送
  const handleSend = useCallback(async () => {
    const trimmedContent = content.trim()
    if (!trimmedContent || isSending || !isConnected) return

    setIsSending(true)
    setContent('')
    
    // 重置 textarea 高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      await sendMessage(trimmedContent, sessionId)
      // 发送成功后生成标题
      generateSessionTitle(sessionId)
    } catch (err) {
      console.error('Failed to send message:', err)
      // 恢复内容
      setContent(trimmedContent)
    } finally {
      setIsSending(false)
    }
  }, [content, isSending, isConnected, sendMessage, sessionId, generateSessionTitle])

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  // 更新会话设置
  const handleModelChange = useCallback((model: string) => {
    setModel(model)
    updateSessionSettings(sessionId, { model })
  }, [setModel, updateSessionSettings, sessionId])

  const handleModeChange = useCallback((mode: string) => {
    setMode(mode)
    updateSessionSettings(sessionId, { mode })
  }, [setMode, updateSessionSettings, sessionId])

  const handleDeepThinkingChange = useCallback((enabled: boolean) => {
    setDeepThinking(enabled)
    updateSessionSettings(sessionId, { deepThinking: enabled })
  }, [setDeepThinking, updateSessionSettings, sessionId])

  const handleWorkspaceChange = useCallback((path: string) => {
    updateSettings({ workspacePath: path })
  }, [updateSettings])

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <ModelSelector value={currentModel} onChange={handleModelChange} />
        <ModeSelector value={currentMode} onChange={handleModeChange} />
        <DeepThinkingToggle enabled={deepThinking} onChange={handleDeepThinkingChange} />
        <div className="flex-1" />
        <WorkspaceSelector path={settings.workspacePath} onChange={handleWorkspaceChange} />
      </div>

      {/* 输入区域 */}
      <div className="relative flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-xl p-2 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500 transition-all">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isConnected ? "输入消息... (Enter 发送, Shift+Enter 换行)" : "等待连接..."}
          disabled={!isConnected || isSending}
          rows={1}
          className="flex-1 bg-transparent border-0 resize-none max-h-[200px] min-h-[40px] py-2.5 px-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none disabled:opacity-50"
        />
        
        <button
          onClick={handleSend}
          disabled={!content.trim() || !isConnected || isSending}
          className={`
            flex-shrink-0 p-2 rounded-lg transition-all duration-200
            ${content.trim() && isConnected && !isSending
              ? 'bg-primary-500 hover:bg-primary-600 text-white shadow-sm' 
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {isSending ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <PaperAirplaneIcon className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* 底部提示 */}
      <div className="flex items-center justify-between mt-1.5 text-xs text-gray-400">
        <span>
          {isConnected 
            ? `${currentModel} · ${currentMode}${deepThinking ? ' · 深度思考' : ''}` 
            : '未连接'}
        </span>
        <span>
          {content.length > 0 && `${content.length} 字符`}
        </span>
      </div>
    </div>
  )
}
