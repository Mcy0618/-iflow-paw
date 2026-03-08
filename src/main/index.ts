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
    icon: join(__dirname, '../../resources/logo.svg'),
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

  // 选择图片文件
  ipcMain.handle('select-image', async () => {
    if (!mainWindow) return null
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      title: '选择图片',
      filters: [
        { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    })
    
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    // 读取图片文件并转换为 Base64
    const attachments: Array<{ type: string; name: string; content: string }> = []
    
    for (const filePath of result.filePaths) {
      try {
        const fs = await import('fs')
        const path = await import('path')
        
        const fileName = path.default.basename(filePath)
        const fileExt = path.default.extname(filePath).toLowerCase()
        
        // 读取文件内容
        const fileBuffer = fs.default.readFileSync(filePath)
        const base64Content = `data:image/${fileExt.replace('.', '')};base64,${fileBuffer.toString('base64')}`
        
        // 确定 MIME 类型
        const mimeTypes: Record<string, string> = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.bmp': 'image/bmp',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
        }
        
        attachments.push({
          type: mimeTypes[fileExt] || 'image/png',
          name: fileName,
          content: base64Content,
        })
      } catch (error) {
        console.error(`[Main] Failed to read image file: ${filePath}`, error)
      }
    }
    
    return attachments.length > 0 ? attachments : null
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