import React from 'react'
import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline'
import { useTheme, Theme } from '../../hooks/useTheme'

interface AppearancePanelProps {
  className?: string
}

const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: '浅色', icon: <SunIcon className="w-5 h-5" /> },
  { value: 'dark', label: '深色', icon: <MoonIcon className="w-5 h-5" /> },
  { value: 'system', label: '跟随系统', icon: <ComputerDesktopIcon className="w-5 h-5" /> },
]

/**
 * 外观设置面板 - 主题切换和预览
 */
export const AppearancePanel: React.FC<AppearancePanelProps> = ({ className = '' }) => {
  const { theme, setTheme, isDark } = useTheme()

  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h3 className={`text-sm font-medium mb-3 ${
          isDark ? 'text-slate-200' : 'text-slate-900'
        }`}>
          主题
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {themeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setTheme(option.value)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                theme === option.value
                  ? isDark
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-primary-500 bg-primary-50'
                  : isDark
                    ? 'border-slate-700 hover:border-slate-600'
                    : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className={theme === option.value 
                ? 'text-primary-500' 
                : isDark ? 'text-slate-400' : 'text-slate-500'
              }>
                {option.icon}
              </span>
              <span className={`text-sm ${
                isDark ? 'text-slate-200' : 'text-slate-700'
              }`}>
                {option.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={`pt-4 border-t ${
        isDark ? 'border-slate-700' : 'border-slate-200'
      }`}>
        <h4 className={`text-xs font-medium uppercase tracking-wider mb-2 ${
          isDark ? 'text-slate-500' : 'text-slate-400'
        }`}>
          预览
        </h4>
        <div className={`p-4 rounded-xl ${
          isDark 
            ? 'bg-slate-900 border border-slate-700' 
            : 'bg-slate-50 border border-slate-200'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-purple-500" />
            <div>
              <div className={`text-sm font-medium ${
                isDark ? 'text-slate-200' : 'text-slate-800'
              }`}>AI 助手</div>
              <div className={`text-xs ${
                isDark ? 'text-slate-500' : 'text-slate-400'
              }`}>在线</div>
            </div>
          </div>
          <div className={`p-3 rounded-xl text-sm ${
            isDark 
              ? 'bg-slate-800 text-slate-300' 
              : 'bg-white text-slate-700 border border-slate-200'
          }`}>
            你好！有什么我可以帮助你的吗？
          </div>
        </div>
      </div>
    </div>
  )
}
