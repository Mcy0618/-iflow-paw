import React from 'react'
import { Listbox } from '@headlessui/react'
import { LightBulbIcon, ChevronDownIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { MODES } from '../../hooks/useAcp'
import { useRecommendations, isRecommendedMode } from '../../hooks/useRecommendations'

interface ModeSelectorProps {
  value: string
  onChange: (value: string) => void
}

/**
 * 模式选择器组件 - 选择交互模式（带智能推荐）
 */
export const ModeSelector: React.FC<ModeSelectorProps> = ({ value, onChange }) => {
  const selectedMode = MODES.find(m => m.id === value) || MODES[2]
  const { recommendedMode } = useRecommendations()

  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative">
        <Listbox.Button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 
          bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition-all duration-200">
          <LightBulbIcon className="w-3.5 h-3.5" />
          <span>{selectedMode.name}</span>
          {isRecommendedMode(value, recommendedMode) && (
            <SparklesIcon className="w-3 h-3 text-amber-500" title="智能推荐" />
          )}
          <ChevronDownIcon className="w-3 h-3 text-slate-400" />
        </Listbox.Button>

        <Listbox.Options className="absolute bottom-full left-0 mb-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 focus:outline-none z-50">
          {MODES.map((mode) => {
            const isRecommended = isRecommendedMode(mode.id, recommendedMode)
            return (
              <Listbox.Option
                key={mode.id}
                value={mode.id}
                className={({ active, selected }) => {
                  const isSelected = selected
                  return `
                    relative cursor-pointer select-none py-2 px-3 text-sm
                    ${active ? 'bg-primary-50 text-primary-900' : 'text-gray-900'}
                    ${isSelected ? 'bg-primary-50' : ''}
                  `
                }}
              >
                {({ selected }) => {
                  const isSelected = selected
                  return (
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between">
                        <span className={`block ${isSelected ? 'font-medium' : 'font-normal'}`}>
                          {mode.name}
                        </span>
                        {isRecommended && (
                          <SparklesIcon className="w-3 h-3 text-amber-500" title="智能推荐" />
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {mode.desc}
                      </span>
                    </div>
                  )
                }}
              </Listbox.Option>
            )
          })}
        </Listbox.Options>
      </div>
    </Listbox>
  )
}
