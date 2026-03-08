import React from 'react'
import { useAppStore, ConnectionMode } from '../../store/useAppStore'
import { useTheme } from '../../hooks/useTheme'

interface ConnectionPanelProps {
  className?: string
}

const connectionModeOptions: { value: ConnectionMode; label: string; desc: string }[] = [
  { value: 'sdk', label: 'SDK', desc: 'iFlow CLI SDK (推荐)' },
  { value: 'acp', label: 'ACP', desc: '直接使用 ACP WebSocket' },
]

/**
 * 连接设置面板 - 连接模式和状态显示
 */
export const ConnectionPanel: React.FC<ConnectionPanelProps> = ({ className = '' }) => {
  const { isDark } = useTheme()
  const {
    connectionMode,
    setConnectionMode,
    isConnected,
    connectionError,
    connectionStatus,
    reconnectAttempts,
  } = useAppStore()

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 连接模式选择 */}
      <div>
        <h3 className={`text-sm font-medium mb-3 ${
          isDark ? 'text-slate-200' : 'text-slate-900'
        }`}>
          连接模式
        </h3>
        <div className="space-y-2">
          {connectionModeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setConnectionMode(option.value)}
              className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                connectionMode === option.value
                  ? isDark
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-primary-500 bg-primary-50'
                  : isDark
                    ? 'border-slate-700 hover:border-slate-600'
                    : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex flex-col items-start">
                <span className={`font-medium ${
                  connectionMode === option.value 
                    ? 'text-primary-500' 
                    : isDark ? 'text-slate-200' : 'text-slate-700'
                }`}>
                  {option.label}
                </span>
                <span className={`text-xs mt-0.5 ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  {option.desc}
                </span>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 ${
                connectionMode === option.value
                  ? 'border-primary-500 bg-primary-500'
                  : isDark ? 'border-slate-600' : 'border-slate-300'
              }`}>
                {connectionMode === option.value && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 连接状态 */}
      <div className={`pt-4 border-t ${
        isDark ? 'border-slate-700' : 'border-slate-200'
      }`}>
        <h3 className={`text-sm font-medium mb-3 ${
          isDark ? 'text-slate-200' : 'text-slate-900'
        }`}>
          连接状态
        </h3>
        <div className={`p-4 rounded-xl ${
          isDark 
            ? 'bg-slate-900/50 border border-slate-700' 
            : 'bg-slate-50 border border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              connectionError 
                ? 'bg-red-500 animate-pulse' 
                : isConnected 
                  ? 'bg-green-500' 
                  : 'bg-yellow-500'
            }`} />
            <span className={`text-sm ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>
              {connectionError 
                ? `连接错误: ${connectionError}` 
                : isConnected 
                  ? '已连接'
                  : connectionStatus === 'connecting'
                    ? '连接中...'
                    : connectionStatus === 'reconnecting'
                      ? '重连中...'
                      : '未连接'}
            </span>
          </div>
          {/* 显示重连次数 */}
          {connectionStatus === 'reconnecting' && reconnectAttempts > 0 && (
            <span className={`text-xs ${
              isDark ? 'text-slate-500' : 'text-slate-400'
            }`}>
              尝试 {reconnectAttempts}/3
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
