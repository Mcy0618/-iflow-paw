export interface ElectronAPI {
  // 文件夹选择
  selectFolder: () => Promise<string | null>
  
  // 获取应用版本
  getVersion: () => Promise<string>
  
  // 平台信息
  getPlatform: () => Promise<string>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
