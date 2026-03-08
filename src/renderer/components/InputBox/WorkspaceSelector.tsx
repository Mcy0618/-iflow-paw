import React from 'react'
import { FolderIcon } from '@heroicons/react/24/outline'

interface WorkspaceSelectorProps {
  path: string
  onChange: (path: string) => void
}

/**
 * 工作区选择器组件 - 选择当前工作目录
 */
export const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({ path, onChange }) => {
  const handleSelect = async () => {
    if (window.electronAPI?.session?.selectFolder) {
      const result = await window.electronAPI.session.selectFolder()
      if (result) {
        onChange(result)
      }
    }
  }

  return (
    <button
      onClick={handleSelect}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 
        bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition-all duration-200 max-w-[200px]"
      title={path || '选择工作区'}
    >
      <FolderIcon className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="truncate">
        {path ? path.split(/[/\\]/).pop() : '选择工作区'}
      </span>
    </button>
  )
}
