import React from 'react'
import { Listbox } from '@headlessui/react'
import { CommandLineIcon, ChevronDownIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { MODELS } from '../../hooks/useAcp'
import { useRecommendations, isRecommendedModel } from '../../hooks/useRecommendations'

interface ModelSelectorProps {
  value: string
  onChange: (value: string) => void
}

/**
 * 模型选择器组件 - 选择 AI 模型（带智能推荐）
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({ value, onChange }) => {
  const selectedModel = MODELS.find(m => m.id === value) || MODELS[0]
  const { recommendedModel } = useRecommendations()

  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative">
        <Listbox.Button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 
          bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition-all duration-200">
          <CommandLineIcon className="w-3.5 h-3.5" />
          <span className="max-w-[100px] truncate">{selectedModel.name}</span>
          {isRecommendedModel(value, recommendedModel) && (
            <SparklesIcon className="w-3 h-3 text-amber-500" title="智能推荐" />
          )}
          <ChevronDownIcon className="w-3 h-3 text-slate-400" />
        </Listbox.Button>

        <Listbox.Options className="absolute bottom-full left-0 mb-1 w-56 max-h-60 overflow-auto bg-white rounded-lg shadow-lg border border-gray-200 py-1 focus:outline-none z-50">
          {MODELS.map((model) => {
            const isRecommended = isRecommendedModel(model.id, recommendedModel)
            return (
              <Listbox.Option
                key={model.id}
                value={model.id}
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`block truncate ${isSelected ? 'font-medium' : 'font-normal'}`}>
                          {model.name}
                        </span>
                        {isRecommended && (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded-full">
                            <SparklesIcon className="w-2.5 h-2.5" />
                            推荐
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <span className="text-primary-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )}
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
