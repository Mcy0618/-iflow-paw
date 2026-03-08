import React from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useTheme } from '../../hooks/useTheme'
import { useSessions } from '../../hooks/useSessions'

interface GeneralPanelProps {
  className?: string
}

/**
 * 通用设置面板 - 工作区设置等
 */
export const GeneralPanel: React.FC<GeneralPanelProps> = ({ className = '' }) => {
  const { isDark } = useTheme()
  const { settings, updateSettings, addToast } = useAppStore()
  const { currentSession, updateSessionSettings, createSession, switchSession } = useSessions()
  const workspacePath = settings.workspacePath

  const handleSelectWorkspace = async () => {
    if (window.electronAPI?.session?.selectFolder) {
      const result = await window.electronAPI.session.selectFolder()
      if (result) {
        // 更新全局设置
        updateSettings({ workspacePath: result })
        
        // 如果有当前会话，更新会话的工作区
        if (currentSession) {
          updateSessionSettings(currentSession.id, { workingDir: result })
        }
        
        addToast({ type: 'success', message: `工作区已设置: ${result}` })
        
        // 同步到服务器（如果已连接）
        if (typeof window !== 'undefined' && window.electronAPI?.acp?.setWorkspace) {
          try {
            await window.electronAPI.acp.setWorkspace(result)
            console.log('[Workspace] Synced workspace to server from Settings:', result)
          } catch (error) {
            console.error('[Workspace] Failed to sync workspace to server:', error)
          }
        }
      }
    } else {
      addToast({ type: 'error', message: '无法访问文件选择功能' })
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h3 className={`text-sm font-medium mb-4 ${
          isDark ? 'text-slate-200' : 'text-slate-900'
        }`}>
          工作区设置
        </h3>
        
        {/* 当前工作区显示 */}
        <div className={`p-4 rounded-xl border mb-4 ${
          isDark 
            ? 'bg-slate-900/50 border-slate-700' 
            : 'bg-slate-50 border-slate-200'
        }`}>
          <p className={`text-xs mb-1.5 ${
            isDark ? 'text-slate-500' : 'text-slate-500'
          }`}>
            当前工作区
          </p>
          <p className={`text-sm font-medium truncate ${
            isDark ? 'text-slate-200' : 'text-slate-900'
          }`}>
            {workspacePath || '未设置'}
          </p>
        </div>
        
        {/* 按钮组 */}
        <div className="flex gap-3">
          {workspacePath && (
            <button
              onClick={() => {
                updateSettings({ workspacePath: '' })
                // 清除当前会话的工作区
                if (currentSession) {
                  updateSessionSettings(currentSession.id, { workingDir: '' })
                }
                addToast({ type: 'info', message: '工作区已清除' })
              }}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isDark 
                  ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              清除
            </button>
          )}
          <button
            onClick={handleSelectWorkspace}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg ${
              isDark 
                ? 'bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white' 
                : 'bg-gradient-to-r from-primary-500 to-purple-500 hover:from-primary-600 hover:to-purple-600 text-white'
            }`}
          >
            {workspacePath ? '更改工作区' : '选择文件夹'}
          </button>
        </div>
        
        {/* 说明文字 */}
        <p className={`mt-4 text-xs leading-relaxed ${
          isDark ? 'text-slate-500' : 'text-slate-400'
        }`}>
          选择一个工作区文件夹，让 AI 更好地理解你的项目上下文。
          设置后，AI 将能够根据项目结构提供更准确的回答。
        </p>
      </div>
    </div>
  )
}
