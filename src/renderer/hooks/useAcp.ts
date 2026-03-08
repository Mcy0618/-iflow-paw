import { useCallback, useEffect, useState, useRef } from 'react'
import { useAppStore, Message, Attachment } from '../store/useAppStore'
import { v4 as uuidv4 } from 'uuid'

// 重连配置
const RECONNECT_CONFIG = {
  maxAttempts: 3,
  baseDelay: 1000, // 1秒
  maxDelay: 4000,  // 4秒
}

// 同步重试配置
const SYNC_RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 500,  // 500ms
  maxDelay: 2000,  // 2秒
}

// 带重试的同步函数
async function syncWithRetry<T>(
  syncFn: () => Promise<T>,
  config: typeof SYNC_RETRY_CONFIG = SYNC_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await syncFn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt < config.maxAttempts) {
        // 计算延迟时间（指数退避）
        const delay = Math.min(
          config.baseDelay * Math.pow(2, attempt - 1),
          config.maxDelay
        )
        console.log(`[Sync] Attempt ${attempt} failed, retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError || new Error('Sync failed after max attempts')
}

// 支持的模型列表
// Fixed: renamed setDeepThinking to setDeepThinkingHandler to avoid naming conflict
export const MODELS = [
  { id: 'GLM-4.7', name: 'GLM-4.7 (推荐)' },
  { id: 'iFlow-ROME-30BA3B', name: 'iFlow-ROME-30BA3B (预览版)' },
  { id: 'DeepSeek-V3.2', name: 'DeepSeek-V3.2' },
  { id: 'GLM-5', name: 'GLM-5' },
  { id: 'Qwen3-Coder-Plus', name: 'Qwen3-Coder-Plus' },
  { id: 'Kimi-K2-Thinking', name: 'Kimi-K2-Thinking' },
  { id: 'MiniMax-M2.5', name: 'MiniMax-M2.5' },
  { id: 'Kimi-K2.5', name: 'Kimi-K2.5' },
  { id: 'Kimi-K2-0905', name: 'Kimi-K2-0905' }
] as const

// 支持的模式列表
export const MODES = [
  { id: 'YOLO', name: 'YOLO', desc: '自动执行' },
  { id: 'Plan', name: 'Plan', desc: '计划模式' },
  { id: 'Smart', name: 'Smart', desc: '智能判断' },
  { id: 'Ask', name: 'Ask', desc: '询问模式' }
] as const

export type ModelId = typeof MODELS[number]['id']
export type ModeId = typeof MODES[number]['id']

interface UseAcpReturn {
  isConnected: boolean
  isConnecting: boolean
  connectionError: string | null
  connectionStatus: string
  reconnectAttempts: number
  currentModel: string
  currentMode: string
  deepThinking: boolean
  isStreaming: boolean
  sendMessage: (content: string, sessionId: string, attachments?: Attachment[]) => Promise<void>
  regenerateMessage: (sessionId: string, messageId: string) => Promise<void>
  setModel: (model: string) => Promise<void>
  setMode: (mode: string) => Promise<void>
  setDeepThinking: (enabled: boolean) => Promise<void>
  cancelStreaming: () => void
  reconnect: () => Promise<void>
  cancelReconnect: () => void
  processQueue: () => void
  processPendingSync: () => Promise<void>
}

export function useAcp(): UseAcpReturn {
  const {
    isConnected,
    isConnecting,
    connectionError,
    connectionMode,
    connectionStatus,
    reconnectAttempts,
    settings,
    setIsConnected,
    setIsConnecting,
    setConnectionError,
    setConnectionStatus,
    setReconnectAttempts,
    setIsOffline,
    setErrorInfo,
    classifyError,
    addMessage,
    updateMessage,
    deleteMessage,
    addToast,
    removeFromMessageQueue,
    loadMessageQueueFromStorage,
  } = useAppStore()

  const [currentModel, setCurrentModel] = useState(settings.defaultModel)
  const [currentMode, setCurrentMode] = useState(settings.defaultMode)
  const [deepThinking, setDeepThinking] = useState(settings.deepThinking)
  const [isStreaming, setIsStreaming] = useState(false)
  
  // 关键修复：监听 settings 变化，同步更新本地 state
  // 这样当用户切换模型/模式/工作区时，发送消息会使用最新的设置
  useEffect(() => {
    if (settings.defaultModel !== currentModel) {
      console.log('[useAcp] Syncing currentModel from settings:', settings.defaultModel)
      setCurrentModel(settings.defaultModel)
    }
  }, [settings.defaultModel])
  
  useEffect(() => {
    if (settings.defaultMode !== currentMode) {
      console.log('[useAcp] Syncing currentMode from settings:', settings.defaultMode)
      setCurrentMode(settings.defaultMode)
    }
  }, [settings.defaultMode])
  
  useEffect(() => {
    if (settings.deepThinking !== deepThinking) {
      console.log('[useAcp] Syncing deepThinking from settings:', settings.deepThinking)
      setDeepThinking(settings.deepThinking)
    }
  }, [settings.deepThinking])
  
  // 用于取消流式响应的控制器
  const streamingAbortControllerRef = useState(() => new AbortController())[0]
  
  // 重连相关 ref
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isReconnectingRef = useRef(false)

  // 检查 Electron API 是否可用
  const getElectronAPI = useCallback(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      return window.electronAPI
    }
    return null
  }, [])

  // 连接 ACP
  const connect = useCallback(async (isReconnect = false) => {
    const api = getElectronAPI()
    if (!api) {
      setConnectionError('Electron API 不可用')
      setIsConnecting(false)
      setConnectionStatus('disconnected')
      return
    }

    try {
      setIsConnecting(true)
      setConnectionStatus(isReconnect ? 'reconnecting' : 'connecting')
      setConnectionError(null)

      // 传递当前连接模式到主进程
      const result = await api.acp.connect(connectionMode)

      if (result.success) {
        setIsConnected(true)
        setIsConnecting(false)
        setConnectionStatus('connected')
        setConnectionError(null)
        setIsOffline(false)
        setErrorInfo(null)
        setReconnectAttempts(0)
        isReconnectingRef.current = false
        console.log('[ACP] Connected successfully, mode:', connectionMode, 'type:', result.connectionType)
        
        // 关键修复：等待状态完全同步后再继续（确保主进程的连接完全就绪）
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // 连接成功后，同步服务器端的当前设置（特别是模型设置）
        // 这样可以确保工作区切换后使用正确的模型
        try {
          const api = getElectronAPI()
          if (api?.acp?.getSettings) {
            const settingsResult = await api.acp.getSettings()
            if (settingsResult.success && settingsResult.data) {
              console.log('[ACP] Syncing settings from server after connect:', settingsResult.data)
              
              // [修复 4.3] 从 store 获取当前设置进行比较
              const store = useAppStore.getState()
              const currentDefaultModel = store.settings.defaultModel
              const currentDefaultMode = store.settings.defaultMode
              const currentDeepThinking = store.settings.deepThinking
              
              // 同步模型设置
              if (settingsResult.data.model && settingsResult.data.model !== currentDefaultModel) {
                console.log('[ACP] Syncing model from server:', settingsResult.data.model)
                setCurrentModel(settingsResult.data.model)
                useAppStore.getState().updateSettings({ defaultModel: settingsResult.data.model })
              }
              // 同步模式设置
              if (settingsResult.data.mode && settingsResult.data.mode !== currentDefaultMode) {
                console.log('[ACP] Syncing mode from server:', settingsResult.data.mode)
                setCurrentMode(settingsResult.data.mode)
                useAppStore.getState().updateSettings({ defaultMode: settingsResult.data.mode })
              }
              // 同步深度思考设置
              if (settingsResult.data.deepThinking !== undefined && settingsResult.data.deepThinking !== currentDeepThinking) {
                console.log('[ACP] Syncing deepThinking from server:', settingsResult.data.deepThinking)
                setDeepThinking(settingsResult.data.deepThinking)
                useAppStore.getState().updateSettings({ deepThinking: settingsResult.data.deepThinking })
              }
            }
          }
        } catch (syncError) {
          console.error('[ACP] Failed to sync settings from server:', syncError)
        }
        
        // 连接成功后处理消息队列
        await processQueue()
        
        // [修复 4.2] 连接成功后处理待同步设置队列
        await processPendingSync()
      } else {
        const errorInfo = classifyError(result.error || '连接失败')
        setConnectionError(errorInfo.message)
        setErrorInfo(errorInfo)
        setIsConnecting(false)
        setIsConnected(false)
        setIsOffline(true)
        setConnectionStatus('disconnected')
        
        // 触发自动重连
        if (!isReconnectingRef.current && reconnectAttempts < RECONNECT_CONFIG.maxAttempts) {
          scheduleReconnect()
        }
      }
    } catch (error) {
      const errorInfo = classifyError(error)
      setConnectionError(errorInfo.message)
      setErrorInfo(errorInfo)
      setIsConnecting(false)
      setIsConnected(false)
      setIsOffline(true)
      setConnectionStatus('disconnected')
      console.error('[ACP] Connect error:', error)
      
      // 触发自动重连
      if (!isReconnectingRef.current && reconnectAttempts < RECONNECT_CONFIG.maxAttempts) {
        scheduleReconnect()
      }
    }
  }, [getElectronAPI, setIsConnected, setIsConnecting, setConnectionError, setConnectionStatus, 
      setIsOffline, setErrorInfo, setReconnectAttempts, connectionMode, reconnectAttempts, classifyError])

  // 断开连接
  const disconnect = useCallback(async () => {
    const api = getElectronAPI()
    if (!api) return

    try {
      await api.acp.disconnect()
      setIsConnected(false)
      setIsConnecting(false)
      setConnectionStatus('disconnected')
      setIsOffline(true)
      console.log('[ACP] Disconnected')
    } catch (error) {
      console.error('[ACP] Disconnect error:', error)
    }
  }, [getElectronAPI, setIsConnected, setIsConnecting, setConnectionStatus, setIsOffline])

  // 计算重连延迟（指数退避）
  const getReconnectDelay = useCallback((attempt: number): number => {
    const delay = Math.min(
      RECONNECT_CONFIG.baseDelay * Math.pow(2, attempt),
      RECONNECT_CONFIG.maxDelay
    )
    return delay
  }, [])

  // 调度重连
  const scheduleReconnect = useCallback(() => {
    if (isReconnectingRef.current) return
    
    const currentAttempts = useAppStore.getState().reconnectAttempts
    if (currentAttempts >= RECONNECT_CONFIG.maxAttempts) {
      console.log('[ACP] Max reconnect attempts reached')
      addToast({ 
        type: 'error', 
        message: `连接失败（已尝试${RECONNECT_CONFIG.maxAttempts}次），请检查网络后点击右上角重连按钮重试`, 
        duration: 0 // 不自动消失
      })
      setConnectionError(`连接失败：已尝试${RECONNECT_CONFIG.maxAttempts}次，请检查网络后重试`)
      return
    }

    isReconnectingRef.current = true
    const delay = getReconnectDelay(currentAttempts)
    const nextAttempt = currentAttempts + 1
    
    console.log(`[ACP] Scheduling reconnect attempt ${nextAttempt} in ${delay}ms`)
    
    addToast({ 
      type: 'info', 
      message: `正在重连 (${nextAttempt}/${RECONNECT_CONFIG.maxAttempts})...`, 
      duration: 3000 
    })

    reconnectTimerRef.current = setTimeout(() => {
      setReconnectAttempts(nextAttempt)
      connect(true)
    }, delay)
  }, [addToast, getReconnectDelay, setReconnectAttempts, connect])

  // 取消重连
  const cancelReconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    isReconnectingRef.current = false
    setReconnectAttempts(0)
    setConnectionStatus('disconnected')
    console.log('[ACP] Reconnect cancelled')
  }, [setReconnectAttempts, setConnectionStatus])

  // 处理消息队列（在 connect 成功后调用）
  const processQueue = useCallback(async () => {
    const queue = useAppStore.getState().messageQueue
    if (queue.length === 0) return

    console.log(`[ACP] Processing ${queue.length} queued messages`)
    
    // 处理队列中的消息（使用 store 直接发送）
    for (const queuedMessage of [...queue]) {
      try {
        // 消息会在用户界面重新发送，这里只是清除队列
        // 因为消息已经在发送时加入了 UI，我们只需要通知用户
        addToast({ 
          type: 'info', 
          message: `离线消息已恢复发送: ${queuedMessage.content.slice(0, 20)}...`, 
          duration: 3000 
        })
        removeFromMessageQueue(queuedMessage.id)
        console.log(`[ACP] Queued message ${queuedMessage.id} cleared from queue`)
      } catch (error) {
        console.error(`[ACP] Failed to process queued message ${queuedMessage.id}:`, error)
        break
      }
    }
  }, [addToast, removeFromMessageQueue])

  // [修复 4.2] 处理待同步设置队列（在连接成功后调用）
  const processPendingSync = useCallback(async () => {
    const api = getElectronAPI()
    if (!api) {
      console.log('[PendingSync] No Electron API, skipping sync')
      return
    }

    const store = useAppStore.getState()
    const queue = store.pendingSyncQueue
    
    if (queue.length === 0) {
      console.log('[PendingSync] Queue is empty, nothing to sync')
      return
    }

    console.log(`[PendingSync] Processing ${queue.length} pending sync items`)
    
    // 逐个处理队列中的设置同步
    for (const item of [...queue]) {
      try {
        let result: { success: boolean; error?: string } | undefined
        
        switch (item.type) {
          case 'model':
            result = await api.acp.setModel(item.value as string)
            console.log('[PendingSync] Synced model:', item.value, result)
            break
          case 'mode':
            result = await api.acp.setMode(item.value as string)
            console.log('[PendingSync] Synced mode:', item.value, result)
            break
          case 'deepThinking':
            result = await api.acp.setDeepThinking(item.value as boolean)
            console.log('[PendingSync] Synced deepThinking:', item.value, result)
            break
          case 'workspace':
            result = await api.acp.setWorkspace(item.value as string)
            console.log('[PendingSync] Synced workspace:', item.value, result)
            break
          default:
            console.warn('[PendingSync] Unknown sync type:', item.type)
        }
        
        // 同步成功后从队列中移除
        if (result?.success) {
          useAppStore.getState().removeFromPendingSync(item.id)
          addToast({ 
            type: 'success', 
            message: `设置已同步: ${item.type}`, 
            duration: 2000 
          })
        } else {
          console.error(`[PendingSync] Failed to sync ${item.type}:`, result?.error)
        }
      } catch (error) {
        console.error(`[PendingSync] Error syncing ${item.type}:`, error)
        break // 出错时停止处理，等待下次连接成功后再试
      }
    }
  }, [addToast])

  // 重连（手动触发）
  const reconnect = useCallback(async () => {
    cancelReconnect()
    setReconnectAttempts(0)
    await disconnect()
    await connect(false)
  }, [cancelReconnect, setReconnectAttempts, disconnect, connect])

  // 发送消息
  const sendMessage = useCallback(async (content: string, sessionId: string, attachments?: Attachment[]): Promise<void> => {
    const api = getElectronAPI()
    if (!api) {
      throw new Error('Electron API 不可用')
    }

    // 检查连接状态
    if (!isConnected || connectionStatus !== 'connected') {
      console.log('[useAcp] Not connected or status not ready, attempting to reconnect...')
      
      // 显示连接中提示
      addToast({ 
        type: 'info', 
        message: '连接已断开，正在重新连接...', 
        duration: 3000 
      })
      
      await reconnect()
      
      // 等待状态同步
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // 重连后再次检查状态
      const reconnectedState = useAppStore.getState()
      if (!reconnectedState.isConnected || reconnectedState.connectionStatus !== 'connected') {
        throw new Error('重连失败，请检查网络连接后手动重试')
      }
      
      addToast({ 
        type: 'success', 
        message: '连接已恢复', 
        duration: 2000 
      })
    }

    const store = useAppStore.getState()
    const session = store.sessions.find(s => s.id === sessionId)
    if (!session) {
      throw new Error('会话不存在')
    }

    // 创建用户消息
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: Date.now(),
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
    }
    addMessage(sessionId, userMessage)

    // 创建 AI 消息占位
    const aiMessageId = uuidv4()
    const aiMessage: Message = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    }
    addMessage(sessionId, aiMessage)
    
    // 设置流式状态
    setIsStreaming(true)

    try {
      // [修复 4.1] 从 store 获取最新的设置值，避免闭包捕获的过期状态
      const effectiveSettings = useAppStore.getState().settings
      
      console.log('[useAcp] Using settings from store:', { 
        model: effectiveSettings.defaultModel, 
        mode: effectiveSettings.defaultMode, 
        deepThinking: effectiveSettings.deepThinking 
      })

      // SDK/ACP 模式 - 先加载会话到主进程
      const effectiveWorkingDir = session.workingDir || effectiveSettings.workspacePath || ''
      console.log('[useAcp] Loading session with workingDir:', effectiveWorkingDir)
      
      const loadResult = await api.session.load(sessionId, session.title, effectiveWorkingDir, {
        model: effectiveSettings.defaultModel,
        mode: effectiveSettings.defaultMode,
        deepThinking: effectiveSettings.deepThinking,
      })
      if (!loadResult.success) {
        const errorMsg = loadResult.error || '加载会话失败'
        console.error('[useAcp] Session load failed:', errorMsg)
        
        // 检查是否是连接问题
        const isConnectionError = 
          errorMsg.includes('Not connected') || 
          errorMsg.includes('connection state') ||
          errorMsg.includes('Failed to create session') || 
          errorMsg.includes('sessionId') ||
          errorMsg.includes('ECONNREFUSED') ||
          errorMsg.includes('connection') ||
          errorMsg.includes('WebSocket')
        
        if (isConnectionError) {
          console.log('[useAcp] Detected connection error, attempting reconnect...')
          
          try {
            // 更新状态为连接中
            setIsConnecting(true)
            setConnectionStatus('reconnecting')
            
            // 尝试重连
            await reconnect()
            
            // 等待状态同步（给主进程一些时间来完成初始化）
            await new Promise(resolve => setTimeout(resolve, 500))
            
            // 验证重连后的状态
            const reconnectedState = useAppStore.getState()
            if (!reconnectedState.isConnected) {
              throw new Error('重连失败，连接状态未恢复')
            }
            
            // 重连后重试加载会话
            console.log('[useAcp] Retrying session load after reconnect...')
            // [修复 4.1] 同样从 store 获取最新设置
            const retryStore = useAppStore.getState()
            const retryModel = retryStore.settings.defaultModel
            const retryMode = retryStore.settings.defaultMode
            const retryDeepThinking = retryStore.settings.deepThinking
            
            const retryResult = await api.session.load(sessionId, session.title, effectiveWorkingDir, {
              model: retryModel,
              mode: retryMode,
              deepThinking: retryDeepThinking,
            })
            
            if (!retryResult.success) {
              const retryErrorMsg = retryResult.error || '重连后仍失败'
              console.error('[useAcp] Session load failed after reconnect:', retryErrorMsg)
              throw new Error(`会话加载失败（已尝试重连）: ${retryErrorMsg}`)
            }
            
            console.log('[useAcp] Session load succeeded after reconnect')
          } catch (reconnectError) {
            const reconnectErrorMsg = reconnectError instanceof Error ? reconnectError.message : String(reconnectError)
            console.error('[useAcp] Reconnect and retry failed:', reconnectErrorMsg)
            throw new Error(`连接已断开且无法恢复，请点击右上角重连按钮。错误: ${errorMsg}`)
          }
        } else {
          // 非连接错误，直接抛出
          throw new Error(`会话加载失败: ${errorMsg}`)
        }
      }

      // 先设置监听器，再发送请求（避免竞态条件）
      // 使用 Promise 包装流式更新处理
      return new Promise((resolve, reject) => {
        let isCompleted = false
        const timeout = setTimeout(() => {
          if (!isCompleted) {
            isCompleted = true
            setIsStreaming(false)
            updateMessage(sessionId, aiMessageId, { isStreaming: false })
            unsubscribe()
            reject(new Error('请求超时'))
          }
        }, 120000) // 2分钟超时

        // 监听流式更新 - 支持 AionUi 格式和旧格式
        const handleUpdate = (update: unknown) => {
          if (isCompleted) return // 已完成，忽略后续更新
          
          if (typeof update === 'object' && update !== null) {
            // 检查是否是 AionUi 格式的更新 (具有 update 字段)
            if ('update' in update && typeof update.update === 'object' && update.update !== null) {
              // AionUi 格式的更新
              const updateType = (update.update as { sessionUpdate: string }).sessionUpdate;
              
              if (updateType === 'agent_message_chunk') {
                const content = (update.update as { content: { text?: string } }).content;
                if (content && content.text) {
                  const store = useAppStore.getState()
                  const currentSession = store.sessions.find(s => s.id === sessionId)
                  const message = currentSession?.messages.find(m => m.id === aiMessageId)
                  if (message) {
                    updateMessage(sessionId, aiMessageId, {
                      content: message.content + content.text,
                      isStreaming: true,
                    })
                  } else {
                    console.error('[useAcp] Message not found:', aiMessageId);
                  }
                }
              } else if (updateType === 'agent_thought_chunk') {
                // 处理深度思考内容
                const content = (update.update as { content: { text?: string } }).content;
                if (content && content.text) {
                  const store = useAppStore.getState()
                  const currentSession = store.sessions.find(s => s.id === sessionId)
                  const message = currentSession?.messages.find(m => m.id === aiMessageId)
                  if (message) {
                    updateMessage(sessionId, aiMessageId, {
                      thoughts: (message.thoughts || '') + content.text,
                      isThinking: true,
                      isStreaming: true,
                    })
                  }
                }
              } else if (updateType === 'complete') {
                isCompleted = true
                clearTimeout(timeout)
                setIsStreaming(false)
                updateMessage(sessionId, aiMessageId, { isStreaming: false, isThinking: false })
                unsubscribe()
                resolve()
              } else if (updateType === 'error') {
                isCompleted = true
                clearTimeout(timeout)
                setIsStreaming(false)
                updateMessage(sessionId, aiMessageId, { isStreaming: false, isThinking: false })
                unsubscribe()
                reject(new Error('请求处理出错'))
              }
            } else if ('type' in update && typeof update.type === 'string') {
              // 旧格式的更新
              const updateData = update as { type: string; data?: unknown }
              
              if (updateData.type === 'agent_message_chunk') {
                const chunkData = updateData.data as { content?: string; isComplete?: boolean }
                if (chunkData.content) {
                  const store = useAppStore.getState()
                  const currentSession = store.sessions.find(s => s.id === sessionId)
                  const message = currentSession?.messages.find(m => m.id === aiMessageId)
                  if (message) {
                    updateMessage(sessionId, aiMessageId, {
                      content: message.content + chunkData.content,
                      isStreaming: true,
                    })
                  }
                }
                
                if (chunkData.isComplete) {
                  isCompleted = true
                  clearTimeout(timeout)
                  updateMessage(sessionId, aiMessageId, { isStreaming: false, isThinking: false })
                  unsubscribe()
                  resolve()
                }
              } else if (updateData.type === 'agent_thought_chunk') {
                // 处理旧格式的深度思考内容
                const thoughtData = updateData.data as { content?: string; thoughtId?: string }
                if (thoughtData.content) {
                  const store = useAppStore.getState()
                  const currentSession = store.sessions.find(s => s.id === sessionId)
                  const message = currentSession?.messages.find(m => m.id === aiMessageId)
                  if (message) {
                    updateMessage(sessionId, aiMessageId, {
                      thoughts: (message.thoughts || '') + thoughtData.content,
                      isThinking: true,
                      isStreaming: true,
                    })
                  }
                }
              } else if (updateData.type === 'complete') {
                isCompleted = true
                clearTimeout(timeout)
                setIsStreaming(false)
                updateMessage(sessionId, aiMessageId, { isStreaming: false, isThinking: false })
                unsubscribe()
                resolve()
              } else if (updateData.type === 'error') {
                isCompleted = true
                clearTimeout(timeout)
                setIsStreaming(false)
                updateMessage(sessionId, aiMessageId, { isStreaming: false, isThinking: false })
                unsubscribe()
                reject(new Error('请求处理出错'))
              }
            }
          }
        }

        // 在发送请求前先添加监听器
        const unsubscribe = api.acp.onUpdate(handleUpdate)

        // 发送请求，传递 aiMessageId 和 attachments 以便主进程同步
        api.acp.sendPrompt(content, aiMessageId, attachments).then(result => {
          if (!result.success) {
            isCompleted = true
            clearTimeout(timeout)
            setIsStreaming(false)
            unsubscribe()
            reject(new Error(result.error || '发送消息失败'))
          } else {
            // 请求成功，等待流式更新完成
            // 注意：不再使用 500ms 超时，而是依赖 complete 消息或 2分钟总超时
          }
        }).catch(error => {
          isCompleted = true
          clearTimeout(timeout)
          setIsStreaming(false)
          unsubscribe()
          reject(error)
        })
      })
    } catch (error) {
      updateMessage(sessionId, aiMessageId, { isStreaming: false })
      throw error
    }
  }, [getElectronAPI, isConnected, connectionStatus, connectionMode, addMessage, updateMessage, addToast, reconnect])

  // 重新生成消息
  const regenerateMessage = useCallback(async (sessionId: string, messageId: string): Promise<void> => {
    const store = useAppStore.getState()
    const session = store.sessions.find(s => s.id === sessionId)
    if (!session) {
      throw new Error('会话不存在')
    }

    // 找到要重新生成的消息
    const messageIndex = session.messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) {
      throw new Error('消息不存在')
    }

    const targetMessage = session.messages[messageIndex]
    
    // 只能重新生成 AI 消息
    if (targetMessage.role !== 'assistant') {
      throw new Error('只能重新生成 AI 消息')
    }

    // 找到该 AI 消息之前的用户消息
    let userMessageIndex = messageIndex - 1
    let userMessage: Message | null = null
    
    while (userMessageIndex >= 0) {
      const msg = session.messages[userMessageIndex]
      if (msg.role === 'user') {
        userMessage = msg
        break
      }
      userMessageIndex--
    }

    if (!userMessage) {
      throw new Error('找不到对应的用户消息')
    }

    // 删除从目标消息开始的所有后续消息
    const messagesToDelete = session.messages.slice(messageIndex)
    for (const msg of messagesToDelete) {
      deleteMessage(sessionId, msg.id)
    }

    // 重新发送用户消息
    await sendMessage(userMessage.content, sessionId, userMessage.attachments)
  }, [deleteMessage, sendMessage])

  // 设置模型 - 始终更新本地状态，尝试同步到服务器（带重试）
  const setModel = useCallback(async (model: string) => {
    // 如果模型与当前相同，只更新本地状态（避免重复同步）
    const currentModelValue = useAppStore.getState().settings.defaultModel
    if (model === currentModelValue) {
      console.log('[Model] Same model selected, skipping sync:', model)
      setCurrentModel(model)
      return
    }
    
    // 更新本地状态
    setCurrentModel(model)
    useAppStore.getState().updateSettings({ defaultModel: model })
    
    // 添加成功反馈
    addToast({ type: 'success', message: `模型已切换为: ${model}`, duration: 2000 })

    const api = getElectronAPI()
    if (!api || !isConnected) {
      addToast({ type: 'info', message: '设置将在连接后同步到服务器', duration: 3000 })
      return
    }

    try {
      // 使用重试机制同步到服务器
      const result = await syncWithRetry(async () => {
        const res = await api.acp.setModel(model)
        if (!res.success) {
          throw new Error(res.error || 'Unknown error')
        }
        return res
      })
      
      console.log('[Sync] Model synced to server:', result)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error('[Sync] Model sync failed:', errorMsg)
      addToast({ type: 'error', message: `模型同步失败: ${errorMsg}`, duration: 5000 })
      // 记录到待同步队列，连接恢复后会自动重试
      useAppStore.getState().addToPendingSync({ type: 'model', value: model })
    }
  }, [getElectronAPI, isConnected, addToast])

  // 设置模式 - 始终更新本地状态，尝试同步到服务器（带重试）
  const setMode = useCallback(async (mode: string) => {
    // 如果模式与当前相同，只更新本地状态（避免重复同步）
    const currentModeValue = useAppStore.getState().settings.defaultMode
    if (mode === currentModeValue) {
      console.log('[Mode] Same mode selected, skipping sync:', mode)
      setCurrentMode(mode)
      return
    }
    
    // 更新本地状态
    setCurrentMode(mode)
    useAppStore.getState().updateSettings({ defaultMode: mode })
    
    // 添加成功反馈
    const modeLabels: Record<string, string> = {
      'YOLO': 'YOLO (自动执行)',
      'Plan': 'Plan (计划模式)',
      'Smart': 'Smart (智能判断)',
      'Ask': 'Ask (询问模式)'
    }
    addToast({ type: 'success', message: `模式已切换为: ${modeLabels[mode] || mode}`, duration: 2000 })

    const api = getElectronAPI()
    if (!api || !isConnected) {
      addToast({ type: 'info', message: '设置将在连接后同步到服务器', duration: 3000 })
      return
    }

    try {
      // 使用重试机制同步到服务器
      const result = await syncWithRetry(async () => {
        const res = await api.acp.setMode(mode)
        if (!res.success) {
          throw new Error(res.error || 'Unknown error')
        }
        return res
      })
      
      console.log('[Sync] Mode synced to server:', result)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error('[Sync] Mode sync failed:', errorMsg)
      addToast({ type: 'error', message: `模式同步失败: ${errorMsg}`, duration: 5000 })
      // 记录到待同步队列
      useAppStore.getState().addToPendingSync({ type: 'mode', value: mode })
    }
  }, [getElectronAPI, isConnected, addToast])

  // 设置深度思考 - 始终更新本地状态，尝试同步到服务器（带重试）
  const setDeepThinkingHandler = useCallback(async (enabled: boolean) => {
    // 如果状态与当前相同，只更新本地状态（避免重复同步）
    const currentDeepThinkingValue = useAppStore.getState().settings.deepThinking
    if (enabled === currentDeepThinkingValue) {
      console.log('[DeepThinking] Same value selected, skipping sync:', enabled)
      setDeepThinking(enabled)
      return
    }
    
    // 更新本地状态
    setDeepThinking(enabled)
    useAppStore.getState().updateSettings({ deepThinking: enabled })
    
    // 添加成功反馈
    addToast({ 
      type: 'success', 
      message: enabled ? '深度思考已开启' : '深度思考已关闭', 
      duration: 2000 
    })

    const api = getElectronAPI()
    if (!api || !isConnected) {
      addToast({ type: 'info', message: '设置将在连接后同步到服务器', duration: 3000 })
      return
    }

    try {
      // 使用重试机制同步到服务器
      const result = await syncWithRetry(async () => {
        const res = await api.acp.setDeepThinking(enabled)
        if (!res.success) {
          throw new Error(res.error || 'Unknown error')
        }
        return res
      })
      
      console.log('[Sync] Deep thinking synced to server:', result)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error('[Sync] Deep thinking sync failed:', errorMsg)
      addToast({ type: 'error', message: `深度思考同步失败: ${errorMsg}`, duration: 5000 })
      // 记录到待同步队列
      useAppStore.getState().addToPendingSync({ type: 'deepThinking', value: enabled })
    }
  }, [getElectronAPI, isConnected, addToast])

  // 取消流式响应
  const cancelStreaming = useCallback(() => {
    if (isStreaming) {
      // 中止当前流式请求
      streamingAbortControllerRef.abort()
      // 重置状态
      setIsStreaming(false)
      addToast({ type: 'info', message: '已取消当前响应', duration: 2000 })
      
      // 更新当前会话中正在流式传输的消息
      const store = useAppStore.getState()
      const currentSession = store.sessions.find(s => s.id === store.currentSessionId)
      const streamingMessage = currentSession?.messages.find(m => m.isStreaming)
      if (streamingMessage && store.currentSessionId) {
        updateMessage(store.currentSessionId, streamingMessage.id, { 
          isStreaming: false, 
          isThinking: false 
        })
      }
    }
  }, [isStreaming, streamingAbortControllerRef, addToast, updateMessage])

  // 初始连接和事件监听
  useEffect(() => {
    const api = getElectronAPI()
    if (!api) {
      console.error('[ACP] Electron API not available')
      setConnectionError('Electron API 不可用')
      setConnectionStatus('disconnected')
      return
    }

    let mounted = true

    // 初始连接 - 始终调用 IPC，由主进程判断是否复用连接
    const doConnect = async () => {      
      try {
        setIsConnecting(true)
        setConnectionStatus('connecting')
        setConnectionError(null)

        // 从 store 获取最新的连接模式，避免闭包问题
        const currentConnectionMode = useAppStore.getState().connectionMode
        console.log('[ACP] Connecting with mode:', currentConnectionMode)
        
        // 传递当前连接模式到主进程
        const result = await api.acp.connect(currentConnectionMode)

        if (!mounted) return

        // 处理已连接的情况（复用已有连接）
        if (result.success) {
          if ('alreadyConnected' in result && result.alreadyConnected) {
            console.log('[ACP] Reusing existing connection')
          }
          setIsConnected(true)
          setIsConnecting(false)
          setConnectionStatus('connected')
          setConnectionError(null)
          setIsOffline(false)
          setReconnectAttempts(0)
          console.log('[ACP] Connected successfully, mode:', currentConnectionMode, 'type:', result.connectionType)
          
          // 关键修复：等待状态完全同步后再继续
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // 加载离线消息队列
          loadMessageQueueFromStorage()
        } else {
          const errorInfo = classifyError(result.error || '连接失败')
          setConnectionError(errorInfo.message)
          setErrorInfo(errorInfo)
          setIsConnecting(false)
          setIsConnected(false)
          setConnectionStatus('disconnected')
          setIsOffline(true)
        }
      } catch (error) {
        if (!mounted) return
        const errorInfo = classifyError(error)
        setConnectionError(errorInfo.message)
        setErrorInfo(errorInfo)
        setIsConnecting(false)
        setIsConnected(false)
        setConnectionStatus('disconnected')
        setIsOffline(true)
        console.error('[ACP] Connect error:', error)
      }
    }

    doConnect()

    // 监听状态更新
    const unsubscribeError = api.acp.onError((error) => {
      if (!mounted) return
      const errorInfo = classifyError(error)
      setConnectionError(errorInfo.message)
      setErrorInfo(errorInfo)
      setIsConnected(false)
      setIsConnecting(false)
      setConnectionStatus('disconnected')
      setIsOffline(true)
      
      // 触发自动重连
      const currentAttempts = useAppStore.getState().reconnectAttempts
      if (currentAttempts < RECONNECT_CONFIG.maxAttempts && !isReconnectingRef.current) {
        scheduleReconnect()
      }
    })

    // 监听连接状态变化
    const unsubscribeStatus = api.acp.onStatus((status) => {
      if (!mounted) return
      console.log('[ACP] Received status update:', status)
      
      if (status.status === 'connected') {
        setIsConnected(true)
        setIsConnecting(false)
        setConnectionStatus('connected')
        setConnectionError(null)
        setIsOffline(false)
        setReconnectAttempts(0)
        isReconnectingRef.current = false
        console.log('[ACP] Status update: connected')
        
        // 关键修复：等待状态完全同步后再继续
        setTimeout(() => {
          processQueue()
          // [修复 4.2] 连接成功后处理待同步设置队列
          processPendingSync()
        }, 100)
      } else if (status.status === 'disconnected') {
        setIsConnected(false)
        setIsConnecting(false)
        setConnectionStatus('disconnected')
        setConnectionError('连接已断开')
        setIsOffline(true)
        console.log('[ACP] Status update: disconnected')
        
        // 触发自动重连
        const currentAttempts = useAppStore.getState().reconnectAttempts
        if (currentAttempts < RECONNECT_CONFIG.maxAttempts && !isReconnectingRef.current) {
          scheduleReconnect()
        }
      } else if (status.status === 'error') {
        setIsConnected(false)
        setIsConnecting(false)
        setConnectionStatus('disconnected')
        const errorMsg = (status as { error?: string }).error || '连接错误'
        const errorInfo = classifyError(errorMsg)
        setConnectionError(errorInfo.message)
        setErrorInfo(errorInfo)
        setIsOffline(true)
        console.log('[ACP] Status update: error -', errorMsg)
        
        // 触发自动重连
        const currentAttempts = useAppStore.getState().reconnectAttempts
        if (currentAttempts < RECONNECT_CONFIG.maxAttempts && !isReconnectingRef.current) {
          scheduleReconnect()
        }
      }
    })

    // 清理函数 - 不在 React StrictMode 双重挂载时断开连接
    // 只在组件真正卸载时（如窗口关闭）才清理
    return () => {
      mounted = false
      // 取消重连定时器
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      unsubscribeError?.()
      unsubscribeStatus?.()
      // 不主动断开连接，让连接保持
      // 这样可以避免 StrictMode 双重挂载导致的状态问题
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    isConnected,
    isConnecting,
    connectionError,
    connectionStatus,
    reconnectAttempts,
    currentModel,
    currentMode,
    deepThinking,
    isStreaming,
    sendMessage,
    regenerateMessage,
    setModel,
    setMode,
    setDeepThinking: setDeepThinkingHandler,
    reconnect,
    cancelReconnect,
    cancelStreaming,
    processQueue,
    processPendingSync,
  }
}

// 添加 window.electronAPI 类型声明
declare global {
  interface Window {
    electronAPI: {
      acp: {
        connect: (mode?: 'sdk' | 'acp') => Promise<{ success: boolean; error?: string; connectionType?: 'sdk' | 'acp'; fallback?: boolean; alreadyConnected?: boolean }>
        disconnect: () => Promise<void>
        sendPrompt: (prompt: string, aiMessageId?: string, attachments?: Array<{ type: string; name: string; content?: string; path?: string }>) => Promise<{ success: boolean; error?: string; aiMessageId?: string }>
        setMode: (mode: string) => Promise<{ success: boolean; error?: string }>
        setModel: (model: string) => Promise<{ success: boolean; error?: string }>
        setDeepThinking: (enabled: boolean, level?: number) => Promise<{ success: boolean; error?: string }>
        setWorkspace: (path: string) => Promise<{ success: boolean; error?: string }>
        getSettings: () => Promise<{ 
          success: boolean; 
          data?: {
            mode: string;
            model: string;
            deepThinking: boolean;
            deepThinkingLevel?: number;
          };
          error?: string 
        }>
        onMessage: (callback: (data: unknown) => void) => () => void
        onUpdate: (callback: (data: unknown) => void) => () => void
        onError: (callback: (error: string) => void) => () => void
        onStatus: (callback: (status: { status: string }) => void) => () => void
      }
      session: {
        list: () => Promise<Array<{ id: string; title: string; updatedAt: number }>>
        create: (title: string, workingDir: string) => Promise<{ id: string; title: string }>
        load: (sessionId: string, title?: string, workingDir?: string, settings?: unknown) => Promise<{ success: boolean; data?: { id: string; title: string; messages: unknown[] }; error?: string }>
        delete: (sessionId: string) => Promise<{ success: boolean }>
        updateTitle: (sessionId: string, title: string) => Promise<{ success: boolean }>
        selectFolder: () => Promise<string | null>
        selectImage: () => Promise<Array<{ type: string; name: string; content: string }> | null>
      }
      app: {
        getVersion: () => Promise<string>
        getPlatform: () => Promise<string>
      }
    }
  }
}