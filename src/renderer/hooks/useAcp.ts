import { useCallback, useEffect, useState } from 'react'
import { useAppStore, Message } from '../store/useAppStore'
import { v4 as uuidv4 } from 'uuid'

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
  currentModel: string
  currentMode: string
  deepThinking: boolean
  sendMessage: (content: string, sessionId: string) => Promise<void>
  setModel: (model: string) => Promise<void>
  setMode: (mode: string) => Promise<void>
  setDeepThinking: (enabled: boolean) => Promise<void>
  reconnect: () => Promise<void>
}

export function useAcp(): UseAcpReturn {
  const {
    isConnected,
    isConnecting,
    connectionError,
    settings,
    setIsConnected,
    setIsConnecting,
    setConnectionError,
    addMessage,
    updateMessage,
  } = useAppStore()

  const [currentModel, setCurrentModel] = useState(settings.defaultModel)
  const [currentMode, setCurrentMode] = useState(settings.defaultMode)
  const [deepThinking, setDeepThinking] = useState(settings.deepThinking)

  // 检查 Electron API 是否可用
  const getElectronAPI = useCallback(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      return window.electronAPI
    }
    return null
  }, [])

  // 连接 ACP
  const connect = useCallback(async () => {
    const api = getElectronAPI()
    if (!api) {
      setConnectionError('Electron API 不可用')
      setIsConnecting(false)
      return
    }

    try {
      setIsConnecting(true)
      setConnectionError(null)

      const result = await api.acp.connect()

      if (result.success) {
        setIsConnected(true)
        setIsConnecting(false)
        setConnectionError(null)
        console.log('[ACP] Connected successfully')
      } else {
        setConnectionError(result.error || '连接失败')
        setIsConnecting(false)
        setIsConnected(false)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '连接失败'
      setConnectionError(errorMsg)
      setIsConnecting(false)
      setIsConnected(false)
      console.error('[ACP] Connect error:', error)
    }
  }, [getElectronAPI, setIsConnected, setIsConnecting, setConnectionError])

  // 断开连接
  const disconnect = useCallback(async () => {
    const api = getElectronAPI()
    if (!api) return

    try {
      await api.acp.disconnect()
      setIsConnected(false)
      setIsConnecting(false)
      console.log('[ACP] Disconnected')
    } catch (error) {
      console.error('[ACP] Disconnect error:', error)
    }
  }, [getElectronAPI, setIsConnected, setIsConnecting])

  // 重连
  const reconnect = useCallback(async () => {
    await disconnect()
    await connect()
  }, [disconnect, connect])

  // 发送消息
  const sendMessage = useCallback(async (content: string, sessionId: string): Promise<void> => {
    const api = getElectronAPI()
    if (!api) {
      throw new Error('Electron API 不可用')
    }

    if (!isConnected) {
      throw new Error('未连接到后端服务')
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

    try {
      // 先加载会话到主进程（确保主进程有 currentSessionId）
      const loadResult = await api.session.load(sessionId, session.title, session.workingDir, {
        model: session.model,
        mode: session.mode,
        deepThinking: session.deepThinking,
      })
      if (!loadResult.success) {
        throw new Error(loadResult.error || '加载会话失败')
      }

      // 先设置监听器，再发送请求（避免竞态条件）
      // 使用 Promise 包装流式更新处理
      return new Promise((resolve, reject) => {
        let isCompleted = false
        const timeout = setTimeout(() => {
          if (!isCompleted) {
            isCompleted = true
            updateMessage(sessionId, aiMessageId, { isStreaming: false })
            unsubscribe()
            reject(new Error('请求超时'))
          }
        }, 120000) // 2分钟超时

        // 监听流式更新 - 支持 AionUi 格式和旧格式
        const handleUpdate = (update: unknown) => {
          if (isCompleted) return // 已完成，忽略后续更新
          
          console.log('[ACP] Frontend received update:', update)
          
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
                  }
                }
              } else if (updateType === 'complete') {
                isCompleted = true
                clearTimeout(timeout)
                updateMessage(sessionId, aiMessageId, { isStreaming: false })
                unsubscribe()
                resolve()
              } else if (updateType === 'error') {
                isCompleted = true
                clearTimeout(timeout)
                updateMessage(sessionId, aiMessageId, { isStreaming: false })
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
                  updateMessage(sessionId, aiMessageId, { isStreaming: false })
                  unsubscribe()
                  resolve()
                }
              } else if (updateData.type === 'complete') {
                isCompleted = true
                clearTimeout(timeout)
                updateMessage(sessionId, aiMessageId, { isStreaming: false })
                unsubscribe()
                resolve()
              } else if (updateData.type === 'error') {
                isCompleted = true
                clearTimeout(timeout)
                updateMessage(sessionId, aiMessageId, { isStreaming: false })
                unsubscribe()
                reject(new Error('请求处理出错'))
              }
            }
          }
        }

        // 在发送请求前先添加监听器
        const unsubscribe = api.acp.onUpdate(handleUpdate)

        // 发送请求
        api.acp.sendPrompt(content).then(result => {
          if (!result.success) {
            isCompleted = true
            clearTimeout(timeout)
            unsubscribe()
            reject(new Error(result.error || '发送消息失败'))
          } else {
            // 请求成功，等待流式更新完成
            // 如果短时间内没有收到更多更新，视为完成
            setTimeout(() => {
              if (!isCompleted) {
                console.log('[ACP] Request completed, finishing stream')
                isCompleted = true
                clearTimeout(timeout)
                updateMessage(sessionId, aiMessageId, { isStreaming: false })
                unsubscribe()
                resolve()
              }
            }, 500) // 500ms 后如果没有更多更新，视为完成
          }
        }).catch(error => {
          isCompleted = true
          clearTimeout(timeout)
          unsubscribe()
          reject(error)
        })
      })
    } catch (error) {
      updateMessage(sessionId, aiMessageId, { isStreaming: false })
      throw error
    }
  }, [getElectronAPI, isConnected, addMessage, updateMessage])

  // 设置模型
  const setModel = useCallback(async (model: string) => {
    const api = getElectronAPI()
    if (!api) return

    if (!isConnected) {
      console.warn('[ACP] Set model skipped: not connected')
      return
    }

    try {
      const result = await api.acp.setModel(model)
      if (result.success) {
        setCurrentModel(model)
        useAppStore.getState().updateSettings({ defaultModel: model })
      } else {
        // 服务器不支持此方法或参数错误，更新本地状态
        console.warn('[ACP] Set model failed:', result.error)
        setCurrentModel(model)
        useAppStore.getState().updateSettings({ defaultModel: model })
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      // 服务器不支持此方法或参数错误，只记录警告不抛出异常
      if (errorMsg.includes('Method not found') || errorMsg.includes('Invalid params')) {
        console.warn('[ACP] Set model not supported by server, updating local state only:', errorMsg)
        // 仍然更新本地状态
        setCurrentModel(model)
        useAppStore.getState().updateSettings({ defaultModel: model })
      } else {
        console.error('[ACP] Set model error:', error)
        throw error
      }
    }
  }, [getElectronAPI, isConnected])

  // 设置模式
  const setMode = useCallback(async (mode: string) => {
    const api = getElectronAPI()
    if (!api) return

    if (!isConnected) {
      console.warn('[ACP] Set mode skipped: not connected')
      return
    }

    try {
      const result = await api.acp.setMode(mode)
      if (result.success) {
        setCurrentMode(mode)
        useAppStore.getState().updateSettings({ defaultMode: mode })
      } else {
        // 服务器不支持此方法或参数错误，更新本地状态
        console.warn('[ACP] Set mode failed:', result.error)
        setCurrentMode(mode)
        useAppStore.getState().updateSettings({ defaultMode: mode })
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      // 服务器不支持此方法或参数错误，只记录警告不抛出异常
      if (errorMsg.includes('Method not found') || errorMsg.includes('Invalid params')) {
        console.warn('[ACP] Set mode not supported by server, updating local state only:', errorMsg)
        // 仍然更新本地状态
        setCurrentMode(mode)
        useAppStore.getState().updateSettings({ defaultMode: mode })
      } else {
        console.error('[ACP] Set mode error:', error)
        throw error
      }
    }
  }, [getElectronAPI, isConnected])

  // 设置深度思考
  const setDeepThinkingHandler = useCallback(async (enabled: boolean) => {
    const api = getElectronAPI()
    if (!api) return

    if (!isConnected) {
      console.warn('[ACP] Set deep thinking skipped: not connected')
      return
    }

    try {
      const result = await api.acp.setDeepThinking(enabled)
      if (result.success) {
        setDeepThinking(enabled)
        useAppStore.getState().updateSettings({ deepThinking: enabled })
      } else {
        // 服务器不支持此方法或参数错误，更新本地状态
        console.warn('[ACP] Set deep thinking failed:', result.error)
        setDeepThinking(enabled)
        useAppStore.getState().updateSettings({ deepThinking: enabled })
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      // 服务器不支持此方法或参数错误，只记录警告不抛出异常
      if (errorMsg.includes('Method not found') || errorMsg.includes('Invalid params')) {
        console.warn('[ACP] Set deep thinking not supported by server, updating local state only:', errorMsg)
        // 仍然更新本地状态
        setDeepThinking(enabled)
        useAppStore.getState().updateSettings({ deepThinking: enabled })
      } else {
        console.error('[ACP] Set deep thinking error:', error)
        throw error
      }
    }
  }, [getElectronAPI, isConnected])

  // 初始连接和事件监听
  useEffect(() => {
    const api = getElectronAPI()
    if (!api) {
      console.error('[ACP] Electron API not available')
      setConnectionError('Electron API 不可用')
      return
    }

    let mounted = true

    // 初始连接 - 始终调用 IPC，由主进程判断是否复用连接
    const doConnect = async () => {      
      try {
        setIsConnecting(true)
        setConnectionError(null)

        const result = await api.acp.connect()

        if (!mounted) return

        // 处理已连接的情况（复用已有连接）
        if (result.success) {
          if (result.alreadyConnected) {
            console.log('[ACP] Reusing existing connection')
          }
          setIsConnected(true)
          setIsConnecting(false)
          setConnectionError(null)
          console.log('[ACP] Connected successfully')
        } else {
          setConnectionError(result.error || '连接失败')
          setIsConnecting(false)
          setIsConnected(false)
        }
      } catch (error) {
        if (!mounted) return
        const errorMsg = error instanceof Error ? error.message : '连接失败'
        setConnectionError(errorMsg)
        setIsConnecting(false)
        setIsConnected(false)
        console.error('[ACP] Connect error:', error)
      }
    }

    doConnect()

    // 监听状态更新
    const unsubscribeError = api.acp.onError((error) => {
      if (!mounted) return
      setConnectionError(error)
      setIsConnected(false)
      setIsConnecting(false)
    })

    // 监听连接状态变化
    const unsubscribeStatus = api.acp.onStatus((status) => {
      if (!mounted) return
      console.log('[ACP] Received status update:', status)
      if (status.status === 'disconnected') {
        setIsConnected(false)
        setIsConnecting(false)
        setConnectionError('连接已断开')
      }
    })

    // 清理函数 - 不在 React StrictMode 双重挂载时断开连接
    // 只在组件真正卸载时（如窗口关闭）才清理
    return () => {
      mounted = false
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
    currentModel,
    currentMode,
    deepThinking,
    sendMessage,
    setModel,
    setMode,
    setDeepThinking: setDeepThinkingHandler,
    reconnect,
  }
}

// 添加 window.electronAPI 类型声明
declare global {
  interface Window {
    electronAPI: {
      acp: {
        connect: () => Promise<{ success: boolean; error?: string }>
        disconnect: () => Promise<void>
        sendPrompt: (prompt: string) => Promise<{ success: boolean; error?: string }>
        setMode: (mode: string) => Promise<{ success: boolean; error?: string }>
        setModel: (model: string) => Promise<{ success: boolean; error?: string }>
        setDeepThinking: (enabled: boolean, level?: number) => Promise<{ success: boolean; error?: string }>
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
      }
      app: {
        getVersion: () => Promise<string>
        getPlatform: () => Promise<string>
      }
    }
  }
}