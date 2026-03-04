import { useCallback, useMemo } from 'react'
import { useAppStore, Session, Message } from '../store/useAppStore'
import { v4 as uuidv4 } from 'uuid'

interface UseSessionsReturn {
  sessions: Session[]
  currentSession: Session | null
  currentSessionId: string | null
  createSession: () => Session
  deleteSession: (id: string) => void
  switchSession: (id: string) => void
  updateSessionTitle: (id: string, title: string) => void
  updateSessionSettings: (id: string, settings: Partial<Pick<Session, 'model' | 'mode' | 'deepThinking'>>) => void
  clearAllSessions: () => void
  generateSessionTitle: (sessionId: string) => void
}

// 生成会话标题（基于第一条用户消息）
function generateTitleFromContent(content: string): string {
  // 取前 20 个字符，去除换行和多余空格
  const cleaned = content
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20)
  
  return cleaned + (cleaned.length >= 20 ? '...' : '') || '新会话'
}

export function useSessions(): UseSessionsReturn {
  const {
    sessions,
    currentSessionId,
    settings,
    addSession,
    deleteSession: storeDeleteSession,
    setCurrentSessionId,
    updateSession,
    setSessions,
  } = useAppStore()

  // 获取当前会话
  const currentSession = useMemo(() => {
    return sessions.find(s => s.id === currentSessionId) || null
  }, [sessions, currentSessionId])

  // 创建新会话
  const createSession = useCallback((): Session => {
    const now = Date.now()
    const newSession: Session = {
      id: uuidv4(),
      title: '新会话',
      messages: [],
      createdAt: now,
      updatedAt: now,
      model: settings.defaultModel,
      mode: settings.defaultMode,
      deepThinking: settings.deepThinking,
    }
    
    addSession(newSession)
    return newSession
  }, [settings, addSession])

  // 删除会话
  const deleteSession = useCallback((id: string) => {
    storeDeleteSession(id)
  }, [storeDeleteSession])

  // 切换会话
  const switchSession = useCallback((id: string) => {
    const session = sessions.find(s => s.id === id)
    if (session) {
      setCurrentSessionId(id)
    }
  }, [sessions, setCurrentSessionId])

  // 更新会话标题
  const updateSessionTitle = useCallback((id: string, title: string) => {
    updateSession(id, { title: title.slice(0, 50) }) // 限制标题长度
  }, [updateSession])

  // 更新会话设置
  const updateSessionSettings = useCallback((id: string, sessionSettings: Partial<Pick<Session, 'model' | 'mode' | 'deepThinking'>>) => {
    updateSession(id, sessionSettings)
  }, [updateSession])

  // 清空所有会话
  const clearAllSessions = useCallback(() => {
    if (confirm('确定要删除所有会话吗？此操作不可恢复。')) {
      setSessions([])
      setCurrentSessionId(null)
    }
  }, [setSessions, setCurrentSessionId])

  // 自动生成会话标题
  const generateSessionTitle = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session || session.title !== '新会话') {
      return // 只有默认标题才自动生成
    }

    // 找到第一条用户消息
    const firstUserMessage = session.messages.find(m => m.role === 'user')
    if (firstUserMessage && firstUserMessage.content) {
      const title = generateTitleFromContent(firstUserMessage.content)
      updateSession(sessionId, { title })
    }
  }, [sessions, updateSession])

  return {
    sessions,
    currentSession,
    currentSessionId,
    createSession,
    deleteSession,
    switchSession,
    updateSessionTitle,
    updateSessionSettings,
    clearAllSessions,
    generateSessionTitle,
  }
}
