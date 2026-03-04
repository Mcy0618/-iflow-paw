import React, { useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatArea } from './components/ChatArea'
import { useSessions } from './hooks/useSessions'
import { useAppStore } from './store/useAppStore'

function App() {
  const { sessions, currentSession, createSession } = useSessions()
  const isConnected = useAppStore((state) => state.isConnected)
  const isConnecting = useAppStore((state) => state.isConnecting)
  const connectionError = useAppStore((state) => state.connectionError)

  // 如果没有会话，自动创建一个
  useEffect(() => {
    if (sessions.length === 0) {
      createSession()
    }
  }, [sessions.length, createSession])

  return (
    <div className="flex h-screen w-screen bg-white overflow-hidden">
      {/* 左侧边栏 */}
      <Sidebar />

      {/* 右侧聊天区域 */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* 连接状态条 */}
        {!isConnected && !isConnecting && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-red-600">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {connectionError || '未连接到后端服务'}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="text-xs px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors"
            >
              重试
            </button>
          </div>
        )}
        
        {isConnecting && (
          <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-100 flex items-center gap-2 text-sm text-yellow-700">
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            正在连接...
          </div>
        )}

        {/* 聊天区域 */}
        {currentSession ? (
          <ChatArea session={currentSession} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p>选择或创建一个会话开始聊天</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
