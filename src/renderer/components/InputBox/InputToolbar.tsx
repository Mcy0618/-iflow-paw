import React from 'react'
import { ModelSelector } from './ModelSelector'
import { ModeSelector } from './ModeSelector'
import { DeepThinkingToggle } from './DeepThinkingToggle'
import { WorkspaceSelector } from './WorkspaceSelector'

interface InputToolbarProps {
  currentModel: string
  currentMode: string
  deepThinking: boolean
  workspacePath: string
  onModelChange: (model: string) => void
  onModeChange: (mode: string) => void
  onDeepThinkingChange: (enabled: boolean) => void
  onWorkspaceChange: (path: string) => void
}

/**
 * 输入工具栏组件 - 整合所有工具按钮
 */
export const InputToolbar: React.FC<InputToolbarProps> = ({
  currentModel,
  currentMode,
  deepThinking,
  workspacePath,
  onModelChange,
  onModeChange,
  onDeepThinkingChange,
  onWorkspaceChange,
}) => {
  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      <ModelSelector value={currentModel} onChange={onModelChange} />
      <ModeSelector value={currentMode} onChange={onModeChange} />
      <DeepThinkingToggle enabled={deepThinking} onChange={onDeepThinkingChange} />
      <div className="flex-1" />
      <WorkspaceSelector path={workspacePath} onChange={onWorkspaceChange} />
    </div>
  )
}

// 导出子组件
export { ModelSelector } from './ModelSelector'
export { ModeSelector } from './ModeSelector'
export { DeepThinkingToggle } from './DeepThinkingToggle'
export { ImagePreview } from './ImagePreview'
export { WorkspaceSelector } from './WorkspaceSelector'
