import { useCallback, useMemo } from 'react'
import { useAppStore, Session } from '../store/useAppStore'
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
    addToast,
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
      workingDir: settings.workspacePath || '', // 使用全局工作区路径作为默认值
    }
    
    addSession(newSession)
    addToast({ type: 'success', message: '新会话已创建' })
    return newSession
  }, [settings, addSession, addToast])

  // 删除会话
  const deleteSession = useCallback((id: string) => {
    storeDeleteSession(id)
    addToast({ type: 'info', message: '会话已删除' })
  }, [storeDeleteSession, addToast])

  // 切换会话
  const switchSession = useCallback(async (id: string) => {
    const session = sessions.find(s => s.id === id)
    if (session) {
      setCurrentSessionId(id)
      
      // 使用会话保存的设置，如果没有则使用全局设置
      const sessionModel = session.model || settings.defaultModel
      const sessionMode = session.mode || settings.defaultMode
      const sessionDeepThinking = session.deepThinking ?? settings.deepThinking
      
      // 同步到全局设置，确保 UI 显示正确
      useAppStore.getState().updateSettings({
        defaultModel: sessionModel,
        defaultMode: sessionMode,
        deepThinking: sessionDeepThinking,
        workspacePath: session.workingDir || settings.workspacePath,
      })
      
      // 通知主进程加载会话，同步工作区和设置
      if (typeof window !== 'undefined' && window.electronAPI?.session?.load) {
        try {
          await window.electronAPI.session.load(
            id,
            session.title,
            session.workingDir,
            {
              model: sessionModel,
              mode: sessionMode,
              deepThinking: sessionDeepThinking,
            }
          )
          console.log('[Session] Switched session and synced with main process:', id)
        } catch (error) {
          console.error('[Session] Failed to sync session with main process:', error)
          addToast({ type: 'error', message: '会话切换同步失败', duration: 3000 })
        }
      }
    }
  }, [sessions, setCurrentSessionId, settings, addToast])

  // 更新会话标题
  const updateSessionTitle = useCallback((id: string, title: string) => {
    updateSession(id, { title: title.slice(0, 50) }) // 限制标题长度
  }, [updateSession])

  // 更新会话设置
  const updateSessionSettings = useCallback((id: string, sessionSettings: Partial<Pick<Session, 'model' | 'mode' | 'deepThinking' | 'workingDir'>>) => {
    updateSession(id, sessionSettings)
  }, [updateSession])

  // 清空所有会话
  const clearAllSessions = useCallback(() => {
    if (confirm('确定要删除所有会话吗？此操作不可恢复。')) {
      setSessions([])
      setCurrentSessionId(null)
      addToast({ type: 'info', message: '所有会话已清空' })
    }
  }, [setSessions, setCurrentSessionId, addToast])

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
