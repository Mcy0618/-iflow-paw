import React, { useState } from 'react'
import { useAppStore, ProviderConfig } from '../../store/useAppStore'
import { useTheme } from '../../hooks/useTheme'

interface ProviderPanelProps {
  className?: string
}

/**
 * Provider 设置面板 - 管理第三方 API 提供商
 */
export const ProviderPanel: React.FC<ProviderPanelProps> = ({ className = '' }) => {
  const { isDark } = useTheme()
  const { 
    providers, 
    activeProvider, 
    addProvider, 
    removeProvider,
    setActiveProvider,
    addToast,
  } = useAppStore()
  
  const [newProvider, setNewProvider] = useState<Omit<ProviderConfig, 'name'>>({
    apiKey: '',
    baseUrl: '',
    model: '',
    isEnabled: true,
  })
  const [newProviderName, setNewProviderName] = useState('')

  const handleAddProvider = () => {
    if (newProviderName.trim() && newProvider.baseUrl.trim()) {
      addProvider({
        name: newProviderName.trim(),
        ...newProvider,
      })
      setNewProviderName('')
      setNewProvider({ apiKey: '', baseUrl: '', model: '', isEnabled: true })
      addToast({ type: 'success', message: `Provider "${newProviderName.trim()}" 已添加` })
    } else {
      addToast({ type: 'error', message: 'Provider 名称和基础 URL 不能为空' })
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 现有 Provider 列表 */}
      {providers.length > 0 && (
        <div className="space-y-3">
          <h3 className={`text-sm font-medium ${
            isDark ? 'text-slate-200' : 'text-slate-900'
          }`}>
            已配置的 Provider
          </h3>
          {providers.map((provider) => (
            <div 
              key={provider.name}
              className={`p-4 rounded-xl border ${
                isDark 
                  ? 'bg-slate-900/50 border-slate-700' 
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${
                    isDark ? 'text-slate-200' : 'text-slate-800'
                  }`}>
                    {provider.name}
                  </span>
                  {activeProvider === provider.name && (
                    <span className="px-2 py-0.5 text-xs bg-primary-500/10 text-primary-500 rounded-full">
                      当前使用
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setActiveProvider(provider.name)
                      addToast({ type: 'success', message: `已切换到 Provider: ${provider.name}` })
                    }}
                    className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                      activeProvider === provider.name
                        ? 'bg-primary-500 text-white'
                        : isDark
                          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    使用
                  </button>
                  <button
                    onClick={() => {
                      removeProvider(provider.name)
                      addToast({ type: 'info', message: `Provider "${provider.name}" 已删除` })
                    }}
                    className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                      isDark 
                        ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' 
                        : 'bg-red-50 text-red-600 hover:bg-red-100'
                    }`}
                  >
                    删除
                  </button>
                </div>
              </div>
              <div className={`text-xs space-y-1 ${
                isDark ? 'text-slate-500' : 'text-slate-500'
              }`}>
                <div>Base URL: {provider.baseUrl}</div>
                <div>Model: {provider.model || '默认'}</div>
                <div>API Key: {provider.apiKey ? '••••••••' : '未设置'}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 添加新 Provider */}
      <div className={`p-4 rounded-xl border-2 border-dashed ${
        isDark ? 'border-slate-700' : 'border-slate-300'
      }`}>
        <h4 className={`text-sm font-medium mb-4 ${
          isDark ? 'text-slate-200' : 'text-slate-800'
        }`}>
          添加新 Provider
        </h4>
        <div className="space-y-3">
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Provider 名称
            </label>
            <input
              type="text"
              value={newProviderName}
              onChange={(e) => setNewProviderName(e.target.value)}
              placeholder="例如: OpenAI, Claude, Local"
              className={`w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                isDark 
                  ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder-slate-500 focus:border-primary-500' 
                  : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-primary-500'
              } border focus:outline-none focus:ring-1 focus:ring-primary-500`}
            />
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Base URL
            </label>
            <input
              type="text"
              value={newProvider.baseUrl}
              onChange={(e) => setNewProvider({ ...newProvider, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className={`w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                isDark 
                  ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder-slate-500 focus:border-primary-500' 
                  : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-primary-500'
              } border focus:outline-none focus:ring-1 focus:ring-primary-500`}
            />
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              API Key (可选)
            </label>
            <input
              type="password"
              value={newProvider.apiKey}
              onChange={(e) => setNewProvider({ ...newProvider, apiKey: e.target.value })}
              placeholder="sk-..."
              className={`w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                isDark 
                  ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder-slate-500 focus:border-primary-500' 
                  : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-primary-500'
              } border focus:outline-none focus:ring-1 focus:ring-primary-500`}
            />
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              默认模型 (可选)
            </label>
            <input
              type="text"
              value={newProvider.model}
              onChange={(e) => setNewProvider({ ...newProvider, model: e.target.value })}
              placeholder="gpt-4, claude-3-opus"
              className={`w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                isDark 
                  ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder-slate-500 focus:border-primary-500' 
                  : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-primary-500'
              } border focus:outline-none focus:ring-1 focus:ring-primary-500`}
            />
          </div>
          <button
            onClick={handleAddProvider}
            disabled={!newProviderName.trim() || !newProvider.baseUrl.trim()}
            className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
              newProviderName.trim() && newProvider.baseUrl.trim()
                ? 'bg-gradient-to-r from-primary-500 to-purple-500 text-white hover:from-primary-600 hover:to-purple-600 shadow-lg shadow-primary-500/25'
                : isDark
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            添加 Provider
          </button>
        </div>
      </div>
    </div>
  )
}
