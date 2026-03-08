import React, { useState, useCallback } from 'react'
import { 
  PlusIcon, 
  TrashIcon, 
  Cog6ToothIcon,
  ChatBubbleLeftIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'
import { useSessions } from '../../hooks/useSessions'
import { Session } from '../../store/useAppStore'
import { Logo } from '../Logo'
import { Settings } from '../Settings'
import { formatDistanceToNow } from './utils'

// 会话项组件
interface SessionItemProps {
  session: Session
  isActive: boolean
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
}

const SessionItem: React.FC<SessionItemProps> = React.memo(({ session, isActive, onClick, onDelete }) => {
  const [showDelete, setShowDelete] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      className={`
        group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer
        transition-all duration-200 ease-out mx-2 mb-1
        ${isActive 
          ? 'bg-primary-50/80 text-primary-700 shadow-sm ring-1 ring-primary-100' 
          : 'hover:bg-slate-100/80 text-slate-700'
        }
      `}
    >
      {/* 图标 */}
      <div className={`
        flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
        transition-all duration-200
        ${isActive 
          ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-md shadow-primary-200' 
          : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:shadow-sm'
        }
      `}>
        <ChatBubbleLeftIcon className="w-4 h-4" />
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className={`
            text-sm font-semibold truncate pr-2
            ${isActive ? 'text-primary-900' : 'text-slate-900'}
          `}>
            {session.title}
          </h3>
        </div>
        <p className="text-xs text-slate-400 truncate">
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
          flex-shrink-0 p-1.5 rounded-lg transition-all duration-200
          ${showDelete || isActive
            ? 'opacity-100 hover:bg-red-50 hover:text-red-500 text-slate-400' 
            : 'opacity-0'
          }
        `}
        title="删除会话"
      >
        <TrashIcon className="w-4 h-4" />
      </button>

      {/* 激活指示条 */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-primary-400 to-primary-600 rounded-r-full shadow-sm shadow-primary-200" />
      )}
    </div>
  )
}, (prev, next) => {
  // 自定义比较函数：只有当这些关键属性变化时才重新渲染
  return (
    prev.session.id === next.session.id &&
    prev.session.title === next.session.title &&
    prev.session.messages.length === next.session.messages.length &&
    prev.session.updatedAt === next.session.updatedAt &&
    prev.isActive === next.isActive
  )
})



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
      <aside className="w-[280px] flex flex-col bg-white/80 backdrop-blur-xl border-r border-slate-200/60 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        {/* Logo 区域 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60">
          <div className="flex items-center gap-2.5">
            {/* Logo 图标 */}
            <div className="relative">
              <Logo size={32} />
              <div className="absolute inset-0 bg-primary-500/20 blur-xl rounded-full" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">iflow paw</h1>
              <p className="text-xs text-slate-500">AI 助手</p>
            </div>
          </div>

          {/* 新建会话按钮 */}
          <button
            onClick={handleCreateSession}
            className="p-2 hover:bg-slate-100 hover:shadow-sm rounded-xl transition-all duration-200 group"
            title="新建会话"
          >
            <PlusIcon className="w-5 h-5 text-slate-600 group-hover:text-primary-600 transition-colors" />
          </button>
        </div>

        {/* 搜索框 */}
        <div className="px-3 py-2">
          <div className="relative group">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索会话..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-0 rounded-xl text-sm 
                placeholder-slate-400 text-slate-700
                focus:ring-2 focus:ring-primary-500/20 focus:bg-white 
                transition-all duration-200"
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
        <div className="px-3 py-3 border-t border-slate-200/60 flex items-center justify-between">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-all duration-200"
          >
            <Cog6ToothIcon className="w-4 h-4" />
            设置
          </button>

          {sessions.length > 0 && (
            <button
              onClick={clearAllSessions}
              className="px-3 py-2 text-xs text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200"
            >
              清空全部
            </button>
          )}
        </div>
      </aside>

      {/* 设置弹窗 */}
      <Settings 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </>
  )
}

// 工具函数
export { formatDistanceToNow }
