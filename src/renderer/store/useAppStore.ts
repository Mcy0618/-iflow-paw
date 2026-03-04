import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  isStreaming?: boolean
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
}

export interface AppState {
  // 会话状态
  sessions: Session[]
  currentSessionId: string | null
  
  // 连接状态
  isConnected: boolean
  isConnecting: boolean
  connectionError: string | null
  
  // 全局设置
  settings: {
    defaultModel: string
    defaultMode: string
    deepThinking: boolean
    workspacePath: string
  }
  
  // 操作
  setSessions: (sessions: Session[]) => void
  addSession: (session: Session) => void
  updateSession: (id: string, updates: Partial<Session>) => void
  deleteSession: (id: string) => void
  setCurrentSessionId: (id: string | null) => void
  
  setIsConnected: (connected: boolean) => void
  setIsConnecting: (connecting: boolean) => void
  setConnectionError: (error: string | null) => void
  
  updateSettings: (settings: Partial<AppState['settings']>) => void
  
  // 消息操作
  addMessage: (sessionId: string, message: Message) => void
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void
  deleteMessage: (sessionId: string, messageId: string) => void
  clearMessages: (sessionId: string) => void
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
      settings: {
        defaultModel: 'GLM-4.7',
        defaultMode: 'Smart',
        deepThinking: false,
        workspacePath: '',
      },

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
      setIsConnected: (connected) => set({ isConnected: connected }),
      setIsConnecting: (connecting) => set({ isConnecting: connecting }),
      setConnectionError: (error) => set({ connectionError: error }),

      // 设置
      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings },
      })),

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
    }),
    {
      name: 'iflow-paw-storage',
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
        settings: state.settings,
      }),
    }
  )
)
