import React from 'react'
import { Switch } from '@headlessui/react'
import { SparklesIcon } from '@heroicons/react/24/outline'

interface DeepThinkingToggleProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
}

/**
 * 深度思考开关组件 - 启用/禁用深度思考模式
 */
export const DeepThinkingToggle: React.FC<DeepThinkingToggleProps> = ({ enabled, onChange }) => {
  return (
    <Switch
      checked={enabled}
      onChange={onChange}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200
        ${enabled 
          ? 'bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 shadow-sm' 
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }
      `}
    >
      <SparklesIcon className={`w-3.5 h-3.5 ${enabled ? 'text-purple-600 animate-pulse-soft' : ''}`} />
      <span>深度思考</span>
    </Switch>
  )
}
