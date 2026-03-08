import { useEffect, useState, useCallback } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatArea } from './components/ChatArea'
import { Logo } from './components/Logo'
import { Background } from './components/Background'
import { ToastContainer } from './components/Toast'
import { useSessions } from './hooks/useSessions'
import { useTheme } from './hooks/useTheme'
import { useAppStore } from './store/useAppStore'
import { useAcp } from './hooks/useAcp'
import { FolderIcon, XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

// 初始化步骤
type InitStep = 'connecting' | 'workspace' | 'ready'

// 检测是否为 Mac 系统
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
const cmdKey = isMac ? 'metaKey' : 'ctrlKey'

function App() {
  const { sessions, currentSession, createSession } = useSessions()
  const { isDark } = useTheme()
  const { isStreaming, cancelStreaming, regenerateMessage } = useAcp()
  
  // 合并多个 Zustand selector 为单个调用，减少重渲染
  const {
    isConnected,
    isConnecting,
    connectionError,
    connectionStatus,
    reconnectAttempts,
    isOffline,
    messageQueue,
    toasts,
    removeToast,
    settings,
    updateSettings,
    addToast,
  } = useAppStore((state) => ({
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    connectionError: state.connectionError,
    connectionStatus: state.connectionStatus,
    reconnectAttempts: state.reconnectAttempts,
    isOffline: state.isOffline,
    messageQueue: state.messageQueue,
    toasts: state.toasts,
    removeToast: state.removeToast,
    settings: state.settings,
    updateSettings: state.updateSettings,
    addToast: state.addToast,
  }))
  
  const { reconnect } = useAcp()
  
  // 初始化步骤状态
  const [initStep, setInitStep] = useState<InitStep>('connecting')
  const [showWorkspacePrompt, setShowWorkspacePrompt] = useState(false)
  
  // 复制最后一条 AI 回复
  const copyLastAssistantMessage = useCallback(() => {
    if (!currentSession) return
    
    // 从后往前找最后一条 AI 消息
    const lastAssistantMsg = [...currentSession.messages].reverse().find(m => m.role === 'assistant')
    if (lastAssistantMsg && lastAssistantMsg.content) {
      navigator.clipboard.writeText(lastAssistantMsg.content)
        .then(() => {
          addToast({ type: 'success', message: '已复制最后一条 AI 回复', duration: 2000 })
        })
        .catch(() => {
          addToast({ type: 'error', message: '复制失败', duration: 2000 })
        })
    } else {
      addToast({ type: 'info', message: '没有可复制的 AI 回复', duration: 2000 })
    }
  }, [currentSession, addToast])
  
  // 全局快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N: 新建会话
      if (e[cmdKey] && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        createSession()
        addToast({ type: 'info', message: '新会话已创建 (Ctrl+N)', duration: 1500 })
        return
      }
      
      // Ctrl/Cmd + Shift + N: 新建会话（无工作区）
      if (e[cmdKey] && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        const session = createSession()
        // 清空工作区路径
        if (session) {
          const { updateSession } = useAppStore.getState()
          updateSession(session.id, { workingDir: '' })
        }
        addToast({ type: 'info', message: '新会话已创建（无工作区）(Ctrl+Shift+N)', duration: 1500 })
        return
      }
      
      // Ctrl/Cmd + Shift + C: 复制最后一条 AI 回复
      if (e[cmdKey] && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        copyLastAssistantMessage()
        return
      }
      
      // Esc: 取消流式响应
      if (e.key === 'Escape' && isStreaming) {
        e.preventDefault()
        cancelStreaming()
        return
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [createSession, copyLastAssistantMessage, cancelStreaming, isStreaming, addToast])

  // 初始化流程控制
  useEffect(() => {
    // 步骤 1: 等待连接成功
    if (connectionStatus === 'connected') {
      // 连接成功后，检查是否需要设置工作区
      if (!settings.workspacePath) {
        setInitStep('workspace')
        setShowWorkspacePrompt(true)
      } else {
        setInitStep('ready')
      }
    } else if (connectionStatus === 'connecting' || connectionStatus === 'reconnecting') {
      setInitStep('connecting')
    }
  }, [connectionStatus, settings.workspacePath])
  
  // 如果没有会话且已就绪，自动创建一个
  useEffect(() => {
    if (initStep === 'ready' && sessions.length === 0) {
      createSession()
    }
  }, [initStep, sessions.length, createSession])
  
  // 选择工作区
  const handleSelectWorkspace = useCallback(async () => {
    if (window.electronAPI?.session?.selectFolder) {
      const result = await window.electronAPI.session.selectFolder()
      if (result) {
        updateSettings({ workspacePath: result })
        setShowWorkspacePrompt(false)
        setInitStep('ready')
        addToast({ type: 'success', message: '工作区已设置，开始对话吧！', duration: 3000 })
      }
    }
  }, [updateSettings, addToast])
  
  // 跳过工作区设置
  const handleSkipWorkspace = useCallback(() => {
    setShowWorkspacePrompt(false)
  }, [])

  return (
    <div 
      className={`flex h-screen w-screen overflow-hidden transition-colors duration-300 ${
      isDark 
        ? 'bg-slate-900' 
        : 'bg-slate-50'
    }`}
      role="application"
      aria-label="iFlow PAW - AI 助手"
      tabIndex={-1}
    >
      {/* 跳过导航链接 - 无障碍支持 */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-500 focus:text-white focus:rounded-lg focus:shadow-lg"
        onKeyPress={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            document.getElementById('main-content')?.focus()
          }
        }}
      >
        跳转到主内容
      </a>

      {/* 动态背景 */}
      <Background />
      {/* 左侧边栏 */}
      <Sidebar />

      {/* 右侧聊天区域 */}
      <main 
        id="main-content"
        className="flex-1 flex flex-col min-w-0 relative z-10"
        role="main"
        aria-label="聊天区域"
        tabIndex={-1}
      >
        {/* 连接状态条 - 改进无障碍支持 */}
        {/* 已连接状态 - 显示绿色状态条（可选，默认不显示） */}
        {isConnected && connectionStatus === 'connected' && messageQueue.length > 0 && (
          <div className={`px-4 py-2 border-b flex items-center justify-between animate-fade-in $(
            isDark 
              ? 'bg-gradient-to-r from-green-950/50 to-emerald-950/50 border-green-900/50' 
              : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-100'
          )`}>
            <div className={`flex items-center gap-2 text-sm font-medium ${
              isDark ? 'text-green-400' : 'text-green-600'
            }`}>
              <span className="w-2 h-2 rounded-full bg-green-500" />
              已连接 · 正在发送 {messageQueue.length} 条离线消息...
            </div>
          </div>
        )}
        
        {/* 重连中状态 */}
        {connectionStatus === 'reconnecting' && (
          <div className={`px-4 py-2.5 border-b flex items-center justify-between animate-fade-in ${
            isDark 
              ? 'bg-gradient-to-r from-amber-950/50 to-yellow-950/50 border-amber-900/50' 
              : 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-100'
          }`}>
            <div className={`flex items-center gap-2 text-sm font-medium ${
              isDark ? 'text-amber-400' : 'text-amber-600'
            }`}>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              正在重连 ({reconnectAttempts}/3)...
            </div>
            <button
              onClick={() => {
                const { cancelReconnect } = useAcp()
                cancelReconnect()
              }}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all duration-200 shadow-sm font-medium ${
                isDark 
                  ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-900/50' 
                  : 'bg-white hover:bg-amber-50 text-amber-600 border border-amber-100'
              }`}
            >
              取消
            </button>
          </div>
        )}
        
        {/* 连接中状态 */}
        {isConnecting && connectionStatus === 'connecting' && (
          <div className={`px-4 py-2.5 border-b flex items-center gap-2 text-sm animate-fade-in ${
            isDark 
              ? 'bg-gradient-to-r from-blue-950/50 to-indigo-950/50 border-blue-900/50 text-blue-400' 
              : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100 text-blue-700'
          }`}>
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="font-medium">正在连接...</span>
          </div>
        )}
        
        {/* 离线状态 */}
        {!isConnected && !isConnecting && connectionStatus === 'disconnected' && (
          <div className={`px-4 py-2.5 border-b flex items-center justify-between animate-fade-in ${
            isDark 
              ? 'bg-gradient-to-r from-red-950/50 to-orange-950/50 border-red-900/50' 
              : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-100'
          }`}>
            <div className={`flex items-center gap-2 text-sm font-medium ${
              isDark ? 'text-red-400' : 'text-red-600'
            }`}>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {connectionError || '未连接到后端服务'}
              {isOffline && messageQueue.length > 0 && (
                <span className="text-xs opacity-75">· {messageQueue.length} 条消息待发送</span>
              )}
            </div>
            <button
              onClick={reconnect}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all duration-200 shadow-sm font-medium ${
                isDark 
                  ? 'bg-slate-800 hover:bg-slate-700 text-red-400 border border-red-900/50' 
                  : 'bg-white hover:bg-red-50 text-red-600 border border-red-100'
              }`}
            >
              重试
            </button>
          </div>
        )}

        {/* 初始化步骤界面 */}
        {initStep === 'connecting' && (
          <div className={`flex-1 flex items-center justify-center animate-fade-in ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}>
            <div className="text-center">
              <div className="relative mx-auto mb-6">
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-soft-lg animate-pulse ${
                  isDark 
                    ? 'bg-gradient-to-br from-primary-900/50 to-purple-900/50' 
                    : 'bg-gradient-to-br from-primary-100 to-purple-100'
                }`}>
                  <Logo size={48} />
                </div>
                <div className={`absolute -inset-4 blur-2xl rounded-full animate-pulse ${
                  isDark 
                    ? 'bg-gradient-to-r from-primary-500/20 to-purple-500/20' 
                    : 'bg-gradient-to-r from-primary-500/10 to-purple-500/10'
                }`} />
              </div>
              <p className={`font-medium mb-2 ${
                isDark ? 'text-slate-300' : 'text-slate-600'
              }`}>正在连接服务器...</p>
              <p className={`text-sm ${
                isDark ? 'text-slate-500' : 'text-slate-400'
              }`}>请稍候，正在建立安全连接</p>
            </div>
          </div>
        )}

        {/* 工作区设置提示 */}
        {initStep === 'workspace' && !showWorkspacePrompt && (
          <div className={`flex-1 flex items-center justify-center animate-fade-in ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}>
            <div className="text-center">
              <div className="relative mx-auto mb-6">
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-soft-lg ${
                  isDark 
                    ? 'bg-gradient-to-br from-amber-900/50 to-orange-900/50' 
                    : 'bg-gradient-to-br from-amber-100 to-orange-100'
                }`}>
                  <FolderIcon className={`w-10 h-10 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                </div>
              </div>
              <p className={`font-medium mb-2 ${
                isDark ? 'text-slate-300' : 'text-slate-600'
              }`}>需要设置工作区</p>
              <p className={`text-sm mb-4 ${
                isDark ? 'text-slate-500' : 'text-slate-400'
              }`}>请先选择工作区文件夹以开始对话</p>
              <button
                onClick={() => setShowWorkspacePrompt(true)}
                className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg ${
                  isDark 
                    ? 'bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white' 
                    : 'bg-gradient-to-r from-primary-500 to-purple-500 hover:from-primary-600 hover:to-purple-600 text-white'
                }`}
              >
                选择工作区
              </button>
            </div>
          </div>
        )}

        {/* 聊天区域 - 只有就绪后才显示 */}
        {initStep === 'ready' && currentSession && (
          <ChatArea 
            session={currentSession} 
            onRegenerateMessage={regenerateMessage}
          />
        )}

        {/* 就绪但没有会话 */}
        {initStep === 'ready' && !currentSession && (
          <div className={`flex-1 flex items-center justify-center animate-fade-in ${
            isDark ? 'text-slate-500' : 'text-slate-400'
          }`}>
            <div className="text-center">
              <div className="relative mx-auto mb-6">
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-soft-lg ${
                  isDark 
                    ? 'bg-gradient-to-br from-primary-900/50 to-purple-900/50' 
                    : 'bg-gradient-to-br from-primary-100 to-purple-100'
                }`}>
                  <Logo size={48} />
                </div>
                <div className={`absolute -inset-4 blur-2xl rounded-full ${
                  isDark 
                    ? 'bg-gradient-to-r from-primary-500/20 to-purple-500/20' 
                    : 'bg-gradient-to-r from-primary-500/10 to-purple-500/10'
                }`} />
              </div>
              <p className={`font-medium ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>选择或创建一个会话开始聊天</p>
            </div>
          </div>
        )}
        
        {/* Toast 通知容器 */}
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        
        {/* 工作区引导弹窗 */}
        {showWorkspacePrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className={`relative max-w-md w-full rounded-2xl shadow-2xl p-6 animate-slide-up ${
              isDark 
                ? 'bg-slate-800 border border-slate-700' 
                : 'bg-white border border-slate-200'
            }`}>
              {/* 关闭按钮 */}
              <button
                onClick={handleSkipWorkspace}
                className={`absolute top-4 right-4 p-1 rounded-lg transition-colors ${
                  isDark 
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' 
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
              
              {/* 图标 */}
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${
                isDark 
                  ? 'bg-gradient-to-br from-primary-900/50 to-purple-900/50' 
                  : 'bg-gradient-to-br from-primary-100 to-purple-100'
              }`}>
                <FolderIcon className={`w-7 h-7 ${isDark ? 'text-primary-400' : 'text-primary-600'}`} />
              </div>
              
              {/* 标题 */}
              <h3 className={`text-xl font-bold mb-2 ${
                isDark ? 'text-slate-100' : 'text-slate-900'
              }`}>
                设置工作区
              </h3>
              
              {/* 说明 */}
              <p className={`text-sm mb-6 leading-relaxed ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                选择一个工作区文件夹，让 AI 更好地理解你的项目上下文。
                <br />
                你也可以稍后在设置中更改。
              </p>
              
              {/* 按钮组 */}
              <div className="flex gap-3">
                <button
                  onClick={handleSkipWorkspace}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isDark 
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  跳过
                </button>
                <button
                  onClick={handleSelectWorkspace}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg ${
                    isDark 
                      ? 'bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white' 
                      : 'bg-gradient-to-r from-primary-500 to-purple-500 hover:from-primary-600 hover:to-purple-600 text-white'
                  }`}
                >
                  选择文件夹
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
