import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Toast } from '../components/Toast'

// 主题类型
export type Theme = 'light' | 'dark' | 'system'

// 连接模式类型
export type ConnectionMode = 'sdk' | 'acp' | 'provider'

// 连接状态
export type ConnectionStatus = 'connected' | 'connecting' | 'reconnecting' | 'disconnected'

// 错误类型
export type ErrorType = 'network' | 'server' | 'client' | 'timeout' | 'unknown'

// 待发送消息队列项
export interface QueuedMessage {
  id: string
  sessionId: string
  content: string
  attachments?: Attachment[]
  timestamp: number
  retryCount: number
}

// 待同步设置项
export interface PendingSyncItem {
  id: string
  type: 'model' | 'mode' | 'deepThinking' | 'workspace'
  value: string | boolean
  timestamp: number
  retryCount: number
}

// 错误信息
export interface ErrorInfo {
  type: ErrorType
  message: string
  originalError?: unknown
}

// Provider 配置
export interface ProviderConfig {
  name: string
  apiKey: string
  baseUrl: string
  model: string
  isEnabled: boolean
}

export interface Attachment {
  type: string
  name: string
  content?: string
  path?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  isStreaming?: boolean
  // 深度思考内容
  thoughts?: string
  isThinking?: boolean
  // 附件
  attachments?: Attachment[]
}

export interface Session {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  model: string
  mode: string
  deepThinking: boolean
  workingDir: string // 每个会话的工作目录
}

export interface AppState {
  // 会话状态
  sessions: Session[]
  currentSessionId: string | null
  
  // 连接状态
  isConnected: boolean
  isConnecting: boolean
  connectionError: string | null
  connectionMode: ConnectionMode
  connectionStatus: ConnectionStatus
  reconnectAttempts: number
  maxReconnectAttempts: number
  
  // 离线状态
  isOffline: boolean
  messageQueue: QueuedMessage[]
  pendingSyncQueue: PendingSyncItem[]  // 待同步设置队列
  errorInfo: ErrorInfo | null
  
  // 主题状态
  theme: Theme
  resolvedTheme: 'light' | 'dark' // 实际解析后的主题
  
  // Provider 配置
  providers: ProviderConfig[]
  activeProvider: string | null
  
  // 全局设置
  settings: {
    defaultModel: string
    defaultMode: string
    deepThinking: boolean
    workspacePath: string
  }
  
  // Toast 通知
  toasts: Toast[]
  
  // 操作
  setSessions: (sessions: Session[]) => void
  addSession: (session: Session) => void
  updateSession: (id: string, updates: Partial<Session>) => void
  deleteSession: (id: string) => void
  setCurrentSessionId: (id: string | null) => void
  
  setIsConnected: (connected: boolean) => void
  setIsConnecting: (connecting: boolean) => void
  setConnectionError: (error: string | null) => void
  setConnectionMode: (mode: ConnectionMode) => void
  setConnectionStatus: (status: ConnectionStatus) => void
  setReconnectAttempts: (attempts: number) => void
  
  // 离线状态操作
  setIsOffline: (offline: boolean) => void
  setErrorInfo: (error: ErrorInfo | null) => void
  classifyError: (error: unknown) => ErrorInfo
  addToMessageQueue: (message: QueuedMessage) => void
  removeFromMessageQueue: (id: string) => void
  clearMessageQueue: () => void
  getNextQueuedMessage: () => QueuedMessage | undefined
  saveMessageQueueToStorage: () => void
  loadMessageQueueFromStorage: () => void
  
  // 待同步设置队列操作
  addToPendingSync: (item: Omit<PendingSyncItem, 'id' | 'timestamp' | 'retryCount'>) => void
  removeFromPendingSync: (id: string) => void
  getNextPendingSync: () => PendingSyncItem | undefined
  clearPendingSync: () => void
  
  // 主题操作
  setTheme: (theme: Theme) => void
  setResolvedTheme: (theme: 'light' | 'dark') => void
  
  // Provider 操作
  setProviders: (providers: ProviderConfig[]) => void
  addProvider: (provider: ProviderConfig) => void
  updateProvider: (name: string, updates: Partial<ProviderConfig>) => void
  removeProvider: (name: string) => void
  setActiveProvider: (name: string | null) => void
  
  updateSettings: (settings: Partial<AppState['settings']>) => void
  
  // 工具方法
  getDefaultWorkingDir: () => string
  
  // 消息操作
  addMessage: (sessionId: string, message: Message) => void
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void
  deleteMessage: (sessionId: string, messageId: string) => void
  clearMessages: (sessionId: string) => void
  
  // Toast 通知操作
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  clearAllToasts: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 初始状态
      sessions: [],
      currentSessionId: null,
      isConnected: false,
      isConnecting: false,
      connectionError: null,
      connectionMode: 'sdk',
      connectionStatus: 'disconnected',
      reconnectAttempts: 0,
      maxReconnectAttempts: 3,
      isOffline: false,
      messageQueue: [],
      pendingSyncQueue: [],
      errorInfo: null,
      
      // 主题初始状态
      theme: 'system',
      resolvedTheme: 'light',
      
      // Provider 初始状态
      providers: [],
      activeProvider: null,
      
      settings: {
        defaultModel: 'GLM-4.7',
        defaultMode: 'Smart',
        deepThinking: false,
        workspacePath: '',
      },
      
      // Toast 通知初始状态
      toasts: [],

      // 会话操作
      setSessions: (sessions) => set({ sessions }),
      
      addSession: (session) => set((state) => ({
        sessions: [session, ...state.sessions],
        currentSessionId: session.id,
      })),
      
      updateSession: (id, updates) => set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
        ),
      })),
      
      deleteSession: (id) => set((state) => {
        const newSessions = state.sessions.filter((s) => s.id !== id)
        return {
          sessions: newSessions,
          currentSessionId: state.currentSessionId === id 
            ? (newSessions[0]?.id || null) 
            : state.currentSessionId,
        }
      }),
      
      setCurrentSessionId: (id) => set({ currentSessionId: id }),

      // 连接状态
      setIsConnected: (connected) => set({ 
        isConnected: connected,
        connectionStatus: connected ? 'connected' : 'disconnected',
        isOffline: !connected,
        reconnectAttempts: 0,
      }),
      setIsConnecting: (connecting) => set({ isConnecting: connecting }),
      setConnectionError: (error) => set({ connectionError: error }),
      setConnectionMode: (mode) => set({ connectionMode: mode }),
      setConnectionStatus: (status) => set({ connectionStatus: status }),
      setReconnectAttempts: (attempts) => set({ reconnectAttempts: attempts }),
      
      // 离线状态操作
      setIsOffline: (offline) => set({ isOffline: offline }),
      setErrorInfo: (error) => set({ errorInfo: error }),
      
      // 错误分类
      classifyError: (error: unknown): ErrorInfo => {
        if (error instanceof Error) {
          const message = error.message.toLowerCase()
          
          // 网络错误
          if (
            message.includes('network') ||
            message.includes('fetch') ||
            message.includes('websocket') ||
            message.includes('connection refused') ||
            message.includes('econnrefused') ||
            message.includes('enotfound')
          ) {
            return { type: 'network', message: '网络连接失败，请检查网络设置', originalError: error }
          }
          
          // 超时错误
          if (message.includes('timeout') || message.includes('timed out')) {
            return { type: 'timeout', message: '请求超时，请稍后重试', originalError: error }
          }
          
          // 服务器错误
          if (
            message.includes('500') ||
            message.includes('502') ||
            message.includes('503') ||
            message.includes('server')
          ) {
            return { type: 'server', message: '服务器暂时不可用，正在尝试重连...', originalError: error }
          }
          
          // 客户端错误
          if (message.includes('400') || message.includes('401') || message.includes('403')) {
            return { type: 'client', message: '请求无效，请检查输入内容', originalError: error }
          }
          
          return { type: 'unknown', message: error.message, originalError: error }
        }
        
        return { type: 'unknown', message: String(error) }
      },
      
      // 消息队列操作
      addToMessageQueue: (message) => set((state) => {
        const newQueue = [...state.messageQueue, message]
        // 持久化到 localStorage
        try {
          localStorage.setItem('iflow-paw-message-queue', JSON.stringify(newQueue))
        } catch (e) {
          console.error('[MessageQueue] Failed to save to localStorage:', e)
        }
        return { messageQueue: newQueue }
      }),
      
      removeFromMessageQueue: (id) => set((state) => {
        const newQueue = state.messageQueue.filter(m => m.id !== id)
        try {
          localStorage.setItem('iflow-paw-message-queue', JSON.stringify(newQueue))
        } catch (e) {
          console.error('[MessageQueue] Failed to save to localStorage:', e)
        }
        return { messageQueue: newQueue }
      }),
      
      clearMessageQueue: () => {
        try {
          localStorage.removeItem('iflow-paw-message-queue')
        } catch (e) {
          console.error('[MessageQueue] Failed to clear localStorage:', e)
        }
        set({ messageQueue: [] })
      },
      
      getNextQueuedMessage: () => {
        const state = get()
        return state.messageQueue[0]
      },
      
      saveMessageQueueToStorage: () => {
        const state = get()
        try {
          localStorage.setItem('iflow-paw-message-queue', JSON.stringify(state.messageQueue))
        } catch (e) {
          console.error('[MessageQueue] Failed to save to localStorage:', e)
        }
      },
      
      loadMessageQueueFromStorage: () => {
        try {
          const stored = localStorage.getItem('iflow-paw-message-queue')
          if (stored) {
            const queue = JSON.parse(stored) as QueuedMessage[]
            set({ messageQueue: queue })
          }
        } catch (e) {
          console.error('[MessageQueue] Failed to load from localStorage:', e)
        }
      },

      // 待同步设置队列操作
      addToPendingSync: (item) => set((state) => {
        // 去重：移除队列中相同类型的旧待同步项（保留最新的）
        const filteredQueue = state.pendingSyncQueue.filter((existing) => existing.type !== item.type)
        
        const newItem: PendingSyncItem = {
          ...item,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          retryCount: 0,
        }
        const newQueue = [...filteredQueue, newItem]
        // 保存到 localStorage
        try {
          localStorage.setItem('iflow-paw-pending-sync', JSON.stringify(newQueue))
        } catch (e) {
          console.error('[PendingSync] Failed to save to localStorage:', e)
        }
        console.log('[PendingSync] Added to queue:', newItem.type, item.value, 'Queue length:', newQueue.length)
        return { pendingSyncQueue: newQueue }
      }),

      removeFromPendingSync: (id) => set((state) => {
        const newQueue = state.pendingSyncQueue.filter((item) => item.id !== id)
        try {
          localStorage.setItem('iflow-paw-pending-sync', JSON.stringify(newQueue))
        } catch (e) {
          console.error('[PendingSync] Failed to save to localStorage:', e)
        }
        return { pendingSyncQueue: newQueue }
      }),

      getNextPendingSync: () => {
        const { pendingSyncQueue } = get()
        return pendingSyncQueue[0]
      },

      clearPendingSync: () => {
        set({ pendingSyncQueue: [] })
        try {
          localStorage.removeItem('iflow-paw-pending-sync')
        } catch (e) {
          console.error('[PendingSync] Failed to clear localStorage:', e)
        }
      },

      // 主题操作
      setTheme: (theme) => set({ theme }),
      setResolvedTheme: (resolvedTheme) => set({ resolvedTheme }),
      
      // Provider 操作
      setProviders: (providers) => set({ providers }),
      
      addProvider: (provider) => set((state) => ({
        providers: [...state.providers, provider],
      })),
      
      updateProvider: (name, updates) => set((state) => ({
        providers: state.providers.map((p) =>
          p.name === name ? { ...p, ...updates } : p
        ),
      })),
      
      removeProvider: (name) => set((state) => ({
        providers: state.providers.filter((p) => p.name !== name),
        activeProvider: state.activeProvider === name ? null : state.activeProvider,
      })),
      
      setActiveProvider: (name) => set({ activeProvider: name }),

      // 设置
      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings },
      })),
      
      // 获取默认工作目录（全局设置的工作区路径）
      getDefaultWorkingDir: () => {
        const state = get()
        return state.settings.workspacePath || process.cwd()
      },

      // 消息操作
      addMessage: (sessionId, message) => set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId
            ? { 
                ...s, 
                messages: [...s.messages, message],
                updatedAt: Date.now(),
              }
            : s
        ),
      })),
      
      updateMessage: (sessionId, messageId, updates) => set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === messageId ? { ...m, ...updates } : m
                ),
                updatedAt: Date.now(),
              }
            : s
        ),
      })),
      
      deleteMessage: (sessionId, messageId) => set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                messages: s.messages.filter((m) => m.id !== messageId),
              }
            : s
        ),
      })),
      
      clearMessages: (sessionId) => set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId ? { ...s, messages: [] } : s
        ),
      })),
      
      // Toast 通知方法
      addToast: (toast) => set((state) => ({
        toasts: [...state.toasts, { ...toast, id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }],
      })),
      
      removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      })),
      
      clearAllToasts: () => set({ toasts: [] }),
    }),
    {
      name: 'iflow-paw-storage',
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
        settings: state.settings,
        theme: state.theme,
        providers: state.providers,
        activeProvider: state.activeProvider,
        connectionMode: state.connectionMode,
      }),
    }
  )
)

// ============================================
// 优化的 Selector Hooks - 避免不必要的重渲染
// ============================================

/**
 * 获取当前会话 - 只在 currentSessionId 或 sessions 变化时更新
 */
export const useCurrentSession = () => {
  return useAppStore((state) => {
    const currentSessionId = state.currentSessionId
    const sessions = state.sessions
    return sessions.find(s => s.id === currentSessionId) || null
  })
}

/**
 * 获取当前会话的消息列表 - 只在消息变化时更新
 */
export const useCurrentSessionMessages = () => {
  return useAppStore((state) => {
    const currentSessionId = state.currentSessionId
    const sessions = state.sessions
    const session = sessions.find(s => s.id === currentSessionId)
    return session?.messages || []
  })
}

/**
 * 获取当前会话标题 - 只在标题变化时更新
 */
export const useCurrentSessionTitle = () => {
  return useAppStore((state) => {
    const currentSessionId = state.currentSessionId
    const sessions = state.sessions
    const session = sessions.find(s => s.id === currentSessionId)
    return session?.title || ''
  })
}

/**
 * 获取连接状态 - 只在连接相关状态变化时更新
 */
export const useConnectionState = () => {
  return useAppStore((state) => ({
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    connectionError: state.connectionError,
    connectionMode: state.connectionMode,
  }))
}

/**
 * 获取主题状态 - 只在主题变化时更新
 */
export const useThemeState = () => {
  return useAppStore((state) => ({
    theme: state.theme,
    resolvedTheme: state.resolvedTheme,
  }))
}

/**
 * 获取会话列表 - 只在会话列表变化时更新
 */
export const useSessions = () => {
  return useAppStore((state) => state.sessions)
}

/**
 * 获取当前会话ID - 只在ID变化时更新
 */
export const useCurrentSessionId = () => {
  return useAppStore((state) => state.currentSessionId)
}

/**
 * 获取设置 - 只在设置变化时更新
 */
export const useSettings = () => {
  return useAppStore((state) => state.settings)
}

/**
 * 获取 Providers - 只在 providers 变化时更新
 */
export const useProviders = () => {
  return useAppStore((state) => ({
    providers: state.providers,
    activeProvider: state.activeProvider,
  }))
}

/**
 * 获取 Toasts - 只在 toasts 变化时更新
 */
export const useToasts = () => {
  return useAppStore((state) => state.toasts)
}

/**
 * 获取会话操作方法 - 不会触发重渲染
 */
export const useSessionActions = () => {
  return useAppStore((state) => ({
    setSessions: state.setSessions,
    addSession: state.addSession,
    updateSession: state.updateSession,
    deleteSession: state.deleteSession,
    setCurrentSessionId: state.setCurrentSessionId,
    addMessage: state.addMessage,
    updateMessage: state.updateMessage,
    deleteMessage: state.deleteMessage,
    clearMessages: state.clearMessages,
  }))
}

/**
 * 获取连接操作方法 - 不会触发重渲染
 */
export const useConnectionActions = () => {
  return useAppStore((state) => ({
    setIsConnected: state.setIsConnected,
    setIsConnecting: state.setIsConnecting,
    setConnectionError: state.setConnectionError,
    setConnectionMode: state.setConnectionMode,
  }))
}

/**
 * 获取主题操作方法 - 不会触发重渲染
 */
export const useThemeActions = () => {
  return useAppStore((state) => ({
    setTheme: state.setTheme,
    setResolvedTheme: state.setResolvedTheme,
  }))
}

/**
 * 获取 Toast 操作方法 - 不会触发重渲染
 */
export const useToastActions = () => {
  return useAppStore((state) => ({
    addToast: state.addToast,
    removeToast: state.removeToast,
    clearAllToasts: state.clearAllToasts,
  }))
}