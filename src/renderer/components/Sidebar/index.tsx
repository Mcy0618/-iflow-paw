import React, { useState, useCallback } from 'react'
import { 
  PlusIcon, 
  TrashIcon, 
  Cog6ToothIcon,
  ChatBubbleLeftIcon,
  XMarkIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'
import { useSessions } from '../../hooks/useSessions'
import { useAppStore, Session } from '../../store/useAppStore'
import { formatDistanceToNow } from './utils'

// 会话项组件
interface SessionItemProps {
  session: Session
  isActive: boolean
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
}

const SessionItem: React.FC<SessionItemProps> = ({ session, isActive, onClick, onDelete }) => {
  const [showDelete, setShowDelete] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      className={`
        group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer
        transition-all duration-200 mx-2 mb-1
        ${isActive 
          ? 'bg-primary-50 text-primary-700 border border-primary-100' 
          : 'hover:bg-gray-50 text-gray-700 border border-transparent'
        }
      `}
    >
      {/* 图标 */}
      <div className={`
        flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
        ${isActive ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500'}
      `}>
        <ChatBubbleLeftIcon className="w-4 h-4" />
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className={`
            text-sm font-medium truncate pr-2
            ${isActive ? 'text-primary-900' : 'text-gray-900'}
          `}>
            {session.title}
          </h3>
        </div>
        <p className="text-xs text-gray-400 truncate">
          {session.messages.length > 0 
            ? `${session.messages.length} 条消息 · ${formatDistanceToNow(session.updatedAt)}`
            : '新会话'
          }
        </p>
      </div>

      {/* 删除按钮 */}
      <button
        onClick={onDelete}
        className={`
          flex-shrink-0 p-1.5 rounded-md transition-all duration-200
          ${showDelete || isActive
            ? 'opacity-100 hover:bg-red-100 hover:text-red-600 text-gray-400' 
            : 'opacity-0'
          }
        `}
        title="删除会话"
      >
        <TrashIcon className="w-4 h-4" />
      </button>

      {/* 激活指示条 */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary-500 rounded-r-full" />
      )}
    </div>
  )
}

// 设置弹窗组件
interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const [workspacePath, setWorkspacePath] = useState(settings.workspacePath)

  if (!isOpen) return null

  const handleSave = () => {
    updateSettings({ workspacePath })
    onClose()
  }

  const handleSelectWorkspace = async () => {
    // 通过 IPC 调用主进程选择文件夹
    if (window.electronAPI?.selectFolder) {
      const result = await window.electronAPI.selectFolder()
      if (result) {
        setWorkspacePath(result)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">设置</h2>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-6">
          {/* 工作区路径 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              默认工作区路径
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={workspacePath}
                onChange={(e) => setWorkspacePath(e.target.value)}
                placeholder="选择工作区文件夹..."
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
              <button
                onClick={handleSelectWorkspace}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                浏览
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              AI 将在此目录下执行文件操作
            </p>
          </div>

          {/* 关于 */}
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-sm font-medium text-gray-700 mb-2">关于</h3>
            <p className="text-sm text-gray-500">
              iflow paw v1.0.0
            </p>
            <p className="text-xs text-gray-400 mt-1">
              基于 ACP 协议的 AI 助手
            </p>
          </div>
        </div>

        {/* 底部 */}
        <div className="flex justify-end gap-2 px-6 py-4 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

// 主组件
export const Sidebar: React.FC = () => {
  const { 
    sessions, 
    currentSessionId, 
    createSession, 
    deleteSession, 
    switchSession,
    clearAllSessions,
  } = useSessions()
  const [searchQuery, setSearchQuery] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // 过滤会话
  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // 处理新建会话
  const handleCreateSession = useCallback(() => {
    createSession()
  }, [createSession])

  // 处理删除会话
  const handleDeleteSession = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    if (confirm('确定要删除这个会话吗？')) {
      deleteSession(sessionId)
    }
  }, [deleteSession])

  return (
    <>
      <aside className="w-[280px] flex flex-col bg-gray-50/80 border-r border-gray-200">
        {/* Logo 区域 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/60">
          <div className="flex items-center gap-2.5">
            {/* Logo 图标 */}
            <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900 leading-tight">iflow paw</h1>
              <p className="text-xs text-gray-500">AI 助手</p>
            </div>
          </div>

          {/* 新建会话按钮 */}
          <button
            onClick={handleCreateSession}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors group"
            title="新建会话"
          >
            <PlusIcon className="w-5 h-5 text-gray-600 group-hover:text-primary-600 transition-colors" />
          </button>
        </div>

        {/* 搜索框 */}
        <div className="px-3 py-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索会话..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
            />
          </div>
        </div>

        {/* 会话列表 */}
        <div className="flex-1 overflow-y-auto py-2">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">
                {searchQuery ? '没有找到匹配的会话' : '暂无会话'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-xs text-primary-600 hover:text-primary-700"
                >
                  清除搜索
                </button>
              )}
            </div>
          ) : (
            filteredSessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === currentSessionId}
                onClick={() => switchSession(session.id)}
                onDelete={(e) => handleDeleteSession(e, session.id)}
              />
            ))
          )}
        </div>

        {/* 底部工具栏 */}
        <div className="px-3 py-3 border-t border-gray-200/60 flex items-center justify-between">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Cog6ToothIcon className="w-4 h-4" />
            设置
          </button>

          {sessions.length > 0 && (
            <button
              onClick={clearAllSessions}
              className="px-3 py-2 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              清空全部
            </button>
          )}
        </div>
      </aside>

      {/* 设置弹窗 */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </>
  )
}

// 工具函数
export { formatDistanceToNow }
