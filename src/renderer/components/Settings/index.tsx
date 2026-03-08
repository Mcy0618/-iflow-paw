import React, { Fragment } from 'react'
import { Dialog, Transition, Tab } from '@headlessui/react'
import { XMarkIcon, SunIcon, LinkIcon, ServerIcon, FolderIcon } from '@heroicons/react/24/outline'
import { useTheme } from '../../hooks/useTheme'
import { AppearancePanel } from './AppearancePanel'
import { ConnectionPanel } from './ConnectionPanel'
import { ProviderPanel } from './ProviderPanel'
import { GeneralPanel } from './GeneralPanel'

interface SettingsProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * 设置对话框主组件 - 整合所有设置面板
 */
export const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const { isDark } = useTheme()

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 dark:bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={`w-full max-w-2xl transform overflow-hidden rounded-2xl 
                shadow-2xl transition-all ${
                  isDark 
                    ? 'bg-slate-800 border border-slate-700' 
                    : 'bg-white'
                }`}>
                {/* 头部 */}
                <div className={`flex items-center justify-between px-6 py-4 border-b ${
                  isDark ? 'border-slate-700' : 'border-slate-200'
                }`}>
                  <Dialog.Title className={`text-lg font-semibold ${
                    isDark ? 'text-slate-100' : 'text-slate-900'
                  }`}>
                    设置
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className={`rounded-lg p-1.5 transition-colors ${
                      isDark 
                        ? 'text-slate-400 hover:bg-slate-700 hover:text-slate-200' 
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* 标签页 */}
                <Tab.Group>
                  <Tab.List className={`flex border-b ${
                    isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <Tab as={Fragment}>
                      {({ selected }) => (
                        <button className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                          selected 
                            ? isDark 
                              ? 'text-primary-400 border-b-2 border-primary-400' 
                              : 'text-primary-600 border-b-2 border-primary-600'
                            : isDark 
                              ? 'text-slate-400 hover:text-slate-200' 
                              : 'text-slate-500 hover:text-slate-700'
                        }`}>
                          <SunIcon className="w-4 h-4" />
                          外观
                        </button>
                      )}
                    </Tab>
                    <Tab as={Fragment}>
                      {({ selected }) => (
                        <button className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                          selected 
                            ? isDark 
                              ? 'text-primary-400 border-b-2 border-primary-400' 
                              : 'text-primary-600 border-b-2 border-primary-600'
                            : isDark 
                              ? 'text-slate-400 hover:text-slate-200' 
                              : 'text-slate-500 hover:text-slate-700'
                        }`}>
                          <LinkIcon className="w-4 h-4" />
                          连接
                        </button>
                      )}
                    </Tab>
                    <Tab as={Fragment}>
                      {({ selected }) => (
                        <button className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                          selected 
                            ? isDark 
                              ? 'text-primary-400 border-b-2 border-primary-400' 
                              : 'text-primary-600 border-b-2 border-primary-600'
                            : isDark 
                              ? 'text-slate-400 hover:text-slate-200' 
                              : 'text-slate-500 hover:text-slate-700'
                        }`}>
                          <ServerIcon className="w-4 h-4" />
                          Provider
                        </button>
                      )}
                    </Tab>
                    <Tab as={Fragment}>
                      {({ selected }) => (
                        <button className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                          selected 
                            ? isDark 
                              ? 'text-primary-400 border-b-2 border-primary-400' 
                              : 'text-primary-600 border-b-2 border-primary-600'
                            : isDark 
                              ? 'text-slate-400 hover:text-slate-200' 
                              : 'text-slate-500 hover:text-slate-700'
                        }`}>
                          <FolderIcon className="w-4 h-4" />
                          通用
                        </button>
                      )}
                    </Tab>
                  </Tab.List>

                  <Tab.Panels className="p-6">
                    <Tab.Panel>
                      <AppearancePanel />
                    </Tab.Panel>
                    <Tab.Panel>
                      <ConnectionPanel />
                    </Tab.Panel>
                    <Tab.Panel>
                      <ProviderPanel />
                    </Tab.Panel>
                    <Tab.Panel>
                      <GeneralPanel />
                    </Tab.Panel>
                  </Tab.Panels>
                </Tab.Group>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

export default Settings

// 导出子组件
export { AppearancePanel } from './AppearancePanel'
export { ConnectionPanel } from './ConnectionPanel'
export { ProviderPanel } from './ProviderPanel'
export { GeneralPanel } from './GeneralPanel'