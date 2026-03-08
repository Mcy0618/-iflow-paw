import React, { useState, useRef, useCallback, useEffect } from 'react'
import { PaperAirplaneIcon, PhotoIcon } from '@heroicons/react/24/outline'
import { useAcp } from '../../hooks/useAcp'
import { useSessions } from '../../hooks/useSessions'
import { useAppStore, Attachment } from '../../store/useAppStore'
import { InputToolbar, ImagePreview } from './InputToolbar'

// 检测是否为 Mac 系统
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
const cmdKeyLabel = isMac ? '⌘' : 'Ctrl'

// 字符限制常量
const MAX_CHAR_COUNT = 8000 // 最大字符数限制
const CHAR_COUNT_THRESHOLD = 1000 // 超过此数量开始显示计数

/**
 * 输入框主组件 - 负责消息输入和发送
 */
export const InputBox: React.FC = () => {
  const [content, setContent] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const { 
    sendMessage, 
    setModel, 
    setMode, 
    setDeepThinking,
    isConnected,
    isStreaming,
    currentModel: acpModel,
    currentMode: acpMode,
    deepThinking: acpDeepThinking
  } = useAcp()
  
  const { updateSessionSettings, generateSessionTitle, currentSessionId, createSession, switchSession } = useSessions()
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const updateSession = useAppStore((state) => state.updateSession)
  const addToast = useAppStore((state) => state.addToast)
  
  // 统一状态源
  const currentModel = acpModel
  const currentMode = acpMode
  const deepThinking = acpDeepThinking

  // 自动调整 textarea 高度
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const newHeight = Math.min(textarea.scrollHeight, 200)
      textarea.style.height = `${newHeight}px`
    }
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [content, adjustHeight])

  // 处理发送
  const handleSend = useCallback(async () => {
    const trimmedContent = content.trim()
    if ((!trimmedContent && attachments.length === 0) || isStreaming || !isConnected || !currentSessionId) {
      // 如果因为未连接而阻止发送，提供友好提示
      if (!isConnected && trimmedContent) {
        addToast({ 
          type: 'warning', 
          message: '等待连接恢复中，请稍后再试...', 
          duration: 3000 
        })
      }
      return
    }

    setContent('')
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      await sendMessage(trimmedContent, currentSessionId, attachments.length > 0 ? attachments : undefined)
      setAttachments([])
      generateSessionTitle(currentSessionId)
    } catch (err) {
      console.error('Failed to send message:', err)
      
      // 恢复输入内容，避免用户消息丢失
      setContent(trimmedContent)
      
      // 提供更友好的错误提示
      const errorMsg = err instanceof Error ? err.message : '发送失败'
      
      if (errorMsg.includes('未连接') || errorMsg.includes('重连失败')) {
        addToast({ 
          type: 'error', 
          message: '连接已断开，正在尝试重连，请稍后重试', 
          duration: 5000 
        })
      } else if (errorMsg.includes('会话') || errorMsg.includes('session')) {
        addToast({ 
          type: 'error', 
          message: '会话加载失败，请尝试刷新页面', 
          duration: 5000 
        })
      } else if (errorMsg.includes('超时') || errorMsg.includes('timeout')) {
        addToast({ 
          type: 'error', 
          message: '请求超时，请检查网络后重试', 
          duration: 5000 
        })
      } else {
        addToast({ 
          type: 'error', 
          message: `发送失败: ${errorMsg}`, 
          duration: 5000 
        })
      }
    }
  }, [content, attachments, isStreaming, isConnected, currentSessionId, sendMessage, generateSessionTitle, addToast])

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
    if (currentSessionId) {
      updateSessionSettings(currentSessionId, { model })
    }
  }, [setModel, updateSessionSettings, currentSessionId])

  const handleModeChange = useCallback((mode: string) => {
    setMode(mode)
    if (currentSessionId) {
      updateSessionSettings(currentSessionId, { mode })
    }
  }, [setMode, updateSessionSettings, currentSessionId])

  const handleDeepThinkingChange = useCallback((enabled: boolean) => {
    setDeepThinking(enabled)
    if (currentSessionId) {
      updateSessionSettings(currentSessionId, { deepThinking: enabled })
    }
  }, [setDeepThinking, updateSessionSettings, currentSessionId])

  // 处理文件输入
  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newAttachments: Attachment[] = []
    
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        addToast({ type: 'warning', message: `${file.name} 不是图片文件，已跳过`, duration: 2000 })
        continue
      }
      
      try {
        const reader = new FileReader()
        const content = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        
        newAttachments.push({
          type: file.type,
          name: file.name,
          content: content,
        })
      } catch (error) {
        console.error('Failed to read file:', file.name, error)
        addToast({ type: 'error', message: `读取 ${file.name} 失败`, duration: 2000 })
      }
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments])
      addToast({ type: 'success', message: `已选择 ${newAttachments.length} 张图片`, duration: 2000 })
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [addToast])

  // 处理粘贴
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    const imageItems: DataTransferItem[] = []
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        imageItems.push(item)
      }
    }

    if (imageItems.length === 0) return

    e.preventDefault()
    const newAttachments: Attachment[] = []

    for (const item of imageItems) {
      const file = item.getAsFile()
      if (!file) continue

      try {
        const reader = new FileReader()
        const content = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        newAttachments.push({
          type: file.type,
          name: file.name || `pasted-image-${Date.now()}.png`,
          content: content,
        })
      } catch (error) {
        console.error('Failed to read pasted image:', error)
      }
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments])
      addToast({ type: 'success', message: `已粘贴 ${newAttachments.length} 张图片`, duration: 2000 })
    }
  }, [addToast])

  // 删除附件
  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }, [])

  // 工作区变更 - 创建新会话并切换
  const handleWorkspaceChange = useCallback(async (path: string) => {
    // 获取文件夹名称
    const folderName = path.split(/[\\/]/).pop() || path
    
    // 1. 先更新全局工作区设置
    updateSettings({ workspacePath: path })
    console.log('[Workspace] Global workspace path updated:', path)
    
    // 2. 创建新会话（此时使用更新后的 settings.workspacePath）
    const newSession = createSession()
    const sessionTitle = `新会话 @ ${folderName}`
    
    // 3. 更新新会话的设置（确保工作区路径正确）
    updateSession(newSession.id, { 
      title: sessionTitle,
      workingDir: path,
      model: currentModel,
      mode: currentMode,
      deepThinking: deepThinking,
    })
    console.log('[Workspace] New session created with workingDir:', path)
    
    // 4. 切换到新会话
    await switchSession(newSession.id)
    
    // 5. 显示提示
    addToast({ type: 'success', message: `已创建新会话并切换到工作区: ${path}`, duration: 3000 })
    
    // 6. 同步到服务器（如果已连接）
    if (typeof window !== 'undefined' && window.electronAPI?.acp?.setWorkspace) {
      try {
        const result = await window.electronAPI.acp.setWorkspace(path)
        if (result.success) {
          console.log('[Workspace] Synced workspace to server:', path)
        } else {
          throw new Error(result.error || 'Unknown error')
        }
      } catch (error) {
        console.error('[Workspace] Failed to sync workspace to server:', error)
        // 添加到待同步队列
        useAppStore.getState().addToPendingSync({ type: 'workspace', value: path })
        addToast({ type: 'info', message: '工作区将在连接后同步到服务器', duration: 3000 })
      }
    }
  }, [updateSettings, createSession, switchSession, updateSession, currentModel, currentMode, deepThinking, addToast])

  return (
    <div className="border-t border-slate-200/60 bg-white/80 backdrop-blur-xl px-4 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] z-20 relative">
      {/* 工具栏 */}
      <InputToolbar
        currentModel={currentModel}
        currentMode={currentMode}
        deepThinking={deepThinking}
        workspacePath={settings.workspacePath}
        onModelChange={handleModelChange}
        onModeChange={handleModeChange}
        onDeepThinkingChange={handleDeepThinkingChange}
        onWorkspaceChange={handleWorkspaceChange}
      />

      {/* 图片预览 */}
      <ImagePreview attachments={attachments} onRemove={handleRemoveAttachment} />

      {/* 输入区域 */}
      <div className={`relative flex items-end gap-2 backdrop-blur-sm border rounded-2xl p-2 transition-all duration-300 shadow-sm hover:shadow-md
        bg-white/80 border-gray-200/80 focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500 focus-within:shadow-glow
      `}>
        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />
        
        {/* 图片选择按钮 */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!isConnected || isStreaming || !currentSessionId}
          className={`
            flex-shrink-0 p-2 rounded-lg transition-all duration-200
            ${isConnected && !isStreaming && currentSessionId
              ? 'text-slate-500 hover:text-primary-600 hover:bg-primary-50' 
              : 'text-gray-300 cursor-not-allowed'
            }
          `}
          title="选择图片"
        >
          <PhotoIcon className="w-5 h-5" />
        </button>
        
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={isConnected 
            ? (currentSessionId 
                ? (isStreaming 
                    ? "正在等待响应..." 
                    : "输入消息... (Enter 发送, Shift+Enter 换行，支持粘贴图片)") 
                : "请先创建或选择一个会话") 
            : "等待连接..."}
          disabled={isStreaming || !currentSessionId}
          rows={1}
          className={`flex-1 bg-transparent border-0 resize-none max-h-[200px] min-h-[44px] py-3 px-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none
            ${isStreaming || !currentSessionId ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        />
        
        <button
          onClick={handleSend}
          disabled={(!content.trim() && attachments.length === 0) || isStreaming || !currentSessionId}
          title={`${cmdKeyLabel}+Enter 发送`}
          className={`
            flex-shrink-0 p-3 rounded-xl transition-all duration-300 ease-out transform
            ${(content.trim() || attachments.length > 0) && !isStreaming && currentSessionId
              ? 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {isStreaming ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <PaperAirplaneIcon className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* 底部提示 */}
      <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
        <span className="font-medium">
          {isStreaming 
            ? '⏳ 正在响应... (按 Esc 取消)' 
            : !currentSessionId 
              ? '无活动会话' 
              : isConnected 
                ? `${currentModel} · ${currentMode}${deepThinking ? ' · 深度思考' : ''}${attachments.length > 0 ? ` · ${attachments.length} 张图片` : ''}` 
                : '未连接'}
        </span>
        <div className="flex items-center gap-3">
          {/* 快捷键提示 */}
          {!isStreaming && isConnected && currentSessionId && (
            <span className="text-slate-400 hidden sm:inline">
              {cmdKeyLabel}+N 新建 · {cmdKeyLabel}+Shift+C 复制
            </span>
          )}
          {/* 字符计数 */}
          <span className={`
            ${content.length > MAX_CHAR_COUNT * 0.9 ? 'text-red-500 font-medium' : ''}
            ${content.length > CHAR_COUNT_THRESHOLD || content.length > MAX_CHAR_COUNT * 0.8 ? '' : 'opacity-0'}
            transition-opacity
          `}>
            {content.length > CHAR_COUNT_THRESHOLD && `${content.length.toLocaleString()}`}
            {content.length > MAX_CHAR_COUNT * 0.8 && ` / ${MAX_CHAR_COUNT.toLocaleString()}`}
          </span>
        </div>
      </div>
    </div>
  )
}

// 导出子组件
export { ModelSelector } from './ModelSelector'
export { ModeSelector } from './ModeSelector'
export { DeepThinkingToggle } from './DeepThinkingToggle'
export { ImagePreview } from './ImagePreview'
export { WorkspaceSelector } from './WorkspaceSelector'
export { InputToolbar } from './InputToolbar'