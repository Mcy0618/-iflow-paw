import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers, unregisterIpcHandlers } from './ipc/handlers'

// 保持窗口全局引用，防止被垃圾回收
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'default',
    ...(process.platform === 'linux' ? {} : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // 窗口准备好后显示
  mainWindow.on('ready-to-show', () => {
    if (is.dev) {
      mainWindow?.webContents.openDevTools()
    }
    mainWindow?.show()
  })

  // 处理新窗口打开
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 加载页面
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 窗口关闭处理
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 应用准备就绪
app.whenReady().then(() => {
  // 设置应用用户模型 ID (Windows)
  electronApp.setAppUserModelId('com.iflow.paw')

  // 默认开发环境按 F12 打开开发者工具
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC 处理器
  
  // 选择文件夹
  ipcMain.handle('select-folder', async () => {
    if (!mainWindow) return null
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: '选择工作区文件夹',
    })
    
    return result.canceled ? null : result.filePaths[0]
  })

  // 获取应用版本
  ipcMain.handle('get-version', () => {
    return app.getVersion()
  })

  // 获取平台信息
  ipcMain.handle('get-platform', () => {
    return process.platform
  })

  createWindow()
  
  // 注册 ACP IPC handlers
  if (mainWindow) {
    registerIpcHandlers(mainWindow)
  }

  app.on('activate', function () {
    // macOS: 点击 dock 图标时重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 所有窗口关闭时退出应用 (Windows & Linux)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 应用退出前清理资源 (关键修复：防止孤儿进程和内存泄漏)
app.on('before-quit', async () => {
  console.log('[Main] Application is quitting, cleaning up resources...')
  try {
    // 清理 IPC handlers 和 ACP 连接
    unregisterIpcHandlers()
    console.log('[Main] Resources cleaned up successfully')
  } catch (error) {
    console.error('[Main] Error during cleanup:', error)
  }
})