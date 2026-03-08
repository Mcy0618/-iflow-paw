import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// 连接模式类型
export type ConnectionModeType = 'sdk' | 'acp' | 'provider'

// ACP API 定义
const acpAPI = {
  // 连接管理
  connect: async (mode?: ConnectionModeType): Promise<{ success: boolean; error?: string; connectionType?: string }> => {
    return ipcRenderer.invoke('acp:connect', { mode })
  },
  
  disconnect: async (): Promise<void> => {
    return ipcRenderer.invoke('acp:disconnect')
  },
  
  // 发送消息
  sendPrompt: async (prompt: string, aiMessageId?: string, attachments?: Array<{ type: string; name: string; content?: string; path?: string }>): Promise<{ success: boolean; error?: string; aiMessageId?: string }> => {
    return ipcRenderer.invoke('acp:sendPrompt', { prompt, attachments: attachments || [], aiMessageId })
  },
  
  // 设置选项
  setMode: async (mode: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('acp:setMode', { mode })
  },
  
  setModel: async (model: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('acp:setModel', { model })
  },
  
  setDeepThinking: async (enabled: boolean, level?: number): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('acp:setDeepThinking', { enabled, level })
  },
  
  setWorkspace: async (path: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('acp:setWorkspace', { path })
  },
  
  // 获取当前设置
  getSettings: async (): Promise<{ 
    success: boolean; 
    data?: {
      mode: string;
      model: string;
      deepThinking: boolean;
      deepThinkingLevel?: number;
    };
    error?: string 
  }> => {
    return ipcRenderer.invoke('acp:getSettings')
  },
  
  // 事件监听
  onMessage: (callback: (data: unknown) => void) => {
    const handler = (_: IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on('acp:message', handler)
    return () => ipcRenderer.removeListener('acp:message', handler)
  },
  
  onUpdate: (callback: (data: unknown) => void) => {
    const handler = (_: IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on('acp:update', handler)
    return () => ipcRenderer.removeListener('acp:update', handler)
  },
  
  onError: (callback: (error: string) => void) => {
    const handler = (_: IpcRendererEvent, error: string) => callback(error)
    ipcRenderer.on('acp:error', handler)
    return () => ipcRenderer.removeListener('acp:error', handler)
  },
  
  onStatus: (callback: (status: { status: string }) => void) => {
    const handler = (_: IpcRendererEvent, status: { status: string }) => callback(status)
    ipcRenderer.on('acp:status', handler)
    return () => ipcRenderer.removeListener('acp:status', handler)
  },
}

// 会话 API 定义
const sessionAPI = {
  // 获取所有会话
  list: async (): Promise<Array<{ id: string; title: string; updatedAt: number }>> => {
    return ipcRenderer.invoke('session:list')
  },
  
  // 创建新会话
  create: async (title: string, workingDir: string): Promise<{ id: string; title: string }> => {
    return ipcRenderer.invoke('session:create', title, workingDir)
  },
  
  // 加载会话
  load: async (sessionId: string, title?: string, workingDir?: string, settings?: unknown): Promise<{ success: boolean; data?: { id: string; title: string; messages: unknown[] }; error?: string }> => {
    return ipcRenderer.invoke('session:load', { sessionId, title, workingDir, settings })
  },
  
  // 删除会话
  delete: async (sessionId: string): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('session:delete', sessionId)
  },
  
  // 更新会话标题
  updateTitle: async (sessionId: string, title: string): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('session:updateTitle', sessionId, title)
  },
  
  // 选择工作区文件夹
  selectFolder: async (): Promise<string | null> => {
    return ipcRenderer.invoke('select-folder')
  },
  
  // 选择图片文件
  selectImage: async (): Promise<Array<{ type: string; name: string; content: string }> | null> => {
    return ipcRenderer.invoke('select-image')
  },
}

// 应用 API 定义
const appAPI = {
  getVersion: async (): Promise<string> => {
    return ipcRenderer.invoke('get-version')
  },
  
  getPlatform: async (): Promise<string> => {
    return ipcRenderer.invoke('get-platform')
  },
}

// Provider API 定义
const providerAPI = {
  list: async (): Promise<Array<{ name: string; baseUrl: string; model: string; isEnabled: boolean }>> => {
    return ipcRenderer.invoke('provider:list')
  },
  
  getActive: async (): Promise<{ name: string; baseUrl: string; model: string } | null> => {
    return ipcRenderer.invoke('provider:getActive')
  },
  
  setActive: async (name: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('provider:setActive', { name })
  },
  
  sync: async (providers: Array<{ name: string; apiKey: string; baseUrl: string; model: string; isEnabled: boolean }>, activeProvider: string | null): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('provider:sync', { providers, activeProvider })
  },
  
  sendPrompt: async (messages: Array<{ role: string; content: string }>, options: { model?: string; mode?: string; deepThinking?: boolean }): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('provider:sendPrompt', { messages, options })
  },
}

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  acp: acpAPI,
  session: sessionAPI,
  app: appAPI,
  provider: providerAPI,
})

// 类型导出
export type ElectronAPI = {
  acp: typeof acpAPI
  session: typeof sessionAPI
  app: typeof appAPI
  provider: typeof providerAPI
}
