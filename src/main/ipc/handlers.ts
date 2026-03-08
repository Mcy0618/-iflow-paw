/**
 * IPC Handlers
 * Bridge between renderer process and main process
 */

import { ipcMain, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { AcpConnection } from '../acp/connection';
import { IConnection } from '../acp/interface';
import { ConnectionFactory } from '../acp/connectionFactory';
import { getProviderManager, ProviderManager } from '../providers/provider-manager';
import { sessionStore, Session, Message } from '../store/sessions';
import {
  SessionUpdate,
  SupportedMode,
  SupportedModel,
  AgentMessageChunkData,
  ToolCallData,
  CompleteData,
} from '../acp/types';
import {
  ModelProvider,
  ChatMessage,
} from '../providers/types';

// ============================================================================
// Connection & Provider Instances
// ============================================================================

// Unified connection (SDK or ACP) via ConnectionFactory
let connection: IConnection | null = null;
let connectionType: 'sdk' | 'acp' | null = null;

// Legacy ACP connection reference (for type-specific operations)
let acpConnection: AcpConnection | null = null;

// Provider Manager for OpenAI-compatible APIs
let providerManager: ProviderManager | null = null;

// 保存 BrowserWindow 引用，用于在 IPC handler 中发送消息到渲染进程
let mainWindowRef: BrowserWindow | null = null;

let currentSessionId: string | null = null;
let currentStreamingMessageId: string | null = null;

// Connection mode: 'sdk' | 'acp' | 'provider'
let connectionMode: 'sdk' | 'acp' | 'provider' = 'sdk';

// 防止并发连接竞争 - 关键修复
let isConnecting = false;
let connectionPromise: Promise<{ success: boolean; connectionType?: string; alreadyConnected?: boolean; error?: string }> | null = null;

// 防止并发加载同一会话
const pendingSessionLoads: Map<string, Promise<{ success: boolean; data?: Session; error?: string }>> = new Map();

// ============================================================================
// Helper Functions
// ============================================================================

// Settings.json 读写辅助函数
function getSettingsPath(): string {
  return path.join(os.homedir(), '.iflow', 'settings.json');
}

function readSettingsJson(): Record<string, unknown> {
  const settingsPath = getSettingsPath();
  try {
    if (fs.existsSync(settingsPath)) {
      const content = fs.readFileSync(settingsPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[handlers] Failed to read settings.json:', error);
  }
  return {};
}

function writeSettingsJson(settings: Record<string, unknown>): boolean {
  const settingsPath = getSettingsPath();
  try {
    // 确保目录存在
    const dir = path.dirname(settingsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    console.log('[handlers] Settings saved to:', settingsPath);
    return true;
  } catch (error) {
    console.error('[handlers] Failed to write settings.json:', error);
    return false;
  }
}

function updateSettingsJson(updates: Record<string, unknown>): boolean {
  const currentSettings = readSettingsJson();
  const newSettings = { ...currentSettings, ...updates };
  return writeSettingsJson(newSettings);
}

function getConnection(): IConnection {
  console.log('[Connection Handler] getConnection called, connection exists:', !!connection, 'isConnected:', connection?.isConnected, 'state:', connection?.currentState);
  
  if (!connection) {
    console.error('[Connection Handler] connection is null!');
    throw new Error('Not connected: connection object is null');
  }
  
  // 检查连接是否真正已建立
  if (!connection.isConnected) {
    const state = connection.currentState;
    console.error('[Connection Handler] connection exists but not connected, state:', state);
    throw new Error(`Not connected: connection state is '${state}'`);
  }
  
  return connection;
}



function getProviderMgr(): ProviderManager {
  if (!providerManager) {
    throw new Error('Provider manager not initialized');
  }
  return providerManager;
}

function notifyRenderer(channel: string, ...args: unknown[]): void {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(channel, ...args);
  }
}

// ============================================================================
// ACP Event Handlers
// ============================================================================

function setupConnectionEventHandlers(conn: IConnection, window: BrowserWindow): void {
  // Handle session updates (streaming responses)
  conn.on('update', (data: { sessionId: string; update: SessionUpdate }) => {
    handleSessionUpdate(data.update);
  });

  // Handle connection events
  conn.on('connected', () => {
    console.log('[Connection] Connected event received');
    notifyRenderer('acp:status', { status: 'connected' });
  });

  conn.on('disconnected', () => {
    console.log('[Connection] Disconnected event received');
    notifyRenderer('acp:status', { status: 'disconnected' });
    currentStreamingMessageId = null;
  });

  conn.on('error', (error: Error) => {
    console.log('[Connection] Error event received:', error.message);
    notifyRenderer('acp:status', { status: 'error', error: error.message });
    currentStreamingMessageId = null;
  });

  conn.on('stateChange', (state: string) => {
    console.log('[Connection] State change:', state);
    notifyRenderer('acp:state', { state });
  });

  conn.on('stderr', (data: string) => {
    notifyRenderer('acp:stderr', { data });
  });
}



function handleSessionUpdate(update: SessionUpdate): void {
  console.log('[ACP Handler] handleSessionUpdate called:', JSON.stringify(update, null, 2));
  
  // Forward update to renderer
  notifyRenderer('acp:update', update);
  console.log('[ACP Handler] Update forwarded to renderer');

  // Handle specific update types for session storage
  if (!currentSessionId) return;

  // Check if this is an AionUi-style update (with update field) or legacy update (with type field)
  if ('update' in update && update.update) {
    // AionUi-style update
    const updateType = update.update.sessionUpdate;
    switch (updateType) {
      case 'agent_message_chunk': {
        const content = update.update.content;
        console.log('[ACP Handler] agent_message_chunk:', { content, currentStreamingMessageId, currentSessionId });
        if (content && content.text && currentStreamingMessageId) {
          sessionStore.appendMessageContent(
            currentSessionId,
            currentStreamingMessageId,
            content.text,
            false // For AionUi, we'll handle completion differently
          );
          console.log('[ACP Handler] Message content appended');
        } else {
          console.log('[ACP Handler] Skipping append - missing data:', { hasContent: !!content, hasText: !!content?.text, hasMessageId: !!currentStreamingMessageId });
        }
        break;
      }
      case 'agent_thought_chunk': {
        // Thoughts are not persisted, only displayed
        break;
      }
      case 'tool_call': {
        // Add tool call as a system message
        sessionStore.addMessage(currentSessionId, {
          role: 'tool',
          content: `Tool call: ${update.update.title || 'Unknown'}`,
          metadata: {
            toolId: update.update.toolCallId,
            toolName: update.update.title,
            arguments: update.update.rawInput,
          },
        });
        break;
      }
      case 'tool_call_update': {
        // Tool result is handled by the UI
        break;
      }
      case 'plan': {
        // Plan is displayed in UI, not persisted as message
        break;
      }
      case 'user_message_chunk': {
        // User message chunk - should not happen in response
        break;
      }
      case 'available_commands_update': {
        // Commands update - UI only
        break;
      }
      case 'config_option_update': {
        // Config options update - UI only
        break;
      }
      default:
        // Unknown update type, log for debugging
        console.log('[ACP] Unknown update type:', updateType);
        break;
    }
  } else if ('type' in update && update.type) {
    // Legacy update format
    switch (update.type) {
      case 'agent_message_chunk': {
        const data = update.data as AgentMessageChunkData;
        if (currentStreamingMessageId) {
          sessionStore.appendMessageContent(
            currentSessionId,
            currentStreamingMessageId,
            data.content,
            data.isComplete
          );
          if (data.isComplete) {
            currentStreamingMessageId = null;
          }
        }
        break;
      }

      case 'agent_thought_chunk': {
        // Thoughts are not persisted, only displayed
        break;
      }

      case 'tool_call': {
        const data = update.data as ToolCallData;
        // Add tool call as a system message
        sessionStore.addMessage(currentSessionId, {
          role: 'tool',
          content: `Tool call: ${data.toolName}`,
          metadata: {
            toolId: data.toolId,
            toolName: data.toolName,
            arguments: data.arguments,
          },
        });
        break;
      }

      case 'tool_result': {
        // Tool result is handled by the UI
        break;
      }

      case 'plan': {
        // Plan is displayed in UI, not persisted as message
        break;
      }

      case 'plan_progress': {
        // Plan progress is displayed in UI
        break;
      }

      case 'error': {
        if (currentStreamingMessageId) {
          sessionStore.updateMessage(currentSessionId, currentStreamingMessageId, {
            isStreaming: false,
            metadata: { finishReason: 'error' },
          });
          currentStreamingMessageId = null;
        }
        break;
      }

      case 'complete': {
        const data = update.data as CompleteData;
        if (currentStreamingMessageId) {
          sessionStore.updateMessage(currentSessionId, currentStreamingMessageId, {
            isStreaming: false,
            metadata: { finishReason: data.finishReason },
          });
          currentStreamingMessageId = null;
        }
        break;
      }
    }
  }
}

// ============================================================================
// IPC Handler Registration
// ============================================================================

export function registerIpcHandlers(window: BrowserWindow): void {
  // 保存 BrowserWindow 引用
  mainWindowRef = window;
  
  // Initialize Provider Manager
  providerManager = getProviderManager();
  console.log('[IPC] ProviderManager initialized');

  // ========================================================================
  // Connection Type Handlers
  // ========================================================================

  ipcMain.handle('connection:getType', async () => {
    try {
      return {
        success: true,
        data: {
          type: connectionType,
          mode: connectionMode,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('connection:setMode', async (_event, { mode }: { mode: 'acp' | 'provider' }) => {
    try {
      connectionMode = mode;
      console.log('[IPC] Connection mode set to:', mode);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // ========================================================================
  // ACP Connection Handlers
  // ========================================================================

  ipcMain.handle('acp:connect', async (_event, { mode }: { mode?: 'sdk' | 'acp' | 'provider' }) => {
    console.log('[Connection Handler] acp:connect called, mode:', mode, 'current connection:', !!connection, 'type:', connectionType, 'isConnecting:', isConnecting);
    
    // 更新全局连接模式
    if (mode) {
      connectionMode = mode;
      console.log('[Connection Handler] Connection mode set to:', mode);
    }
    
    // Provider 模式不需要 ACP/SDK 连接
    if (connectionMode === 'provider') {
      console.log('[Connection Handler] Provider mode - no ACP/SDK connection needed');
      return { success: true, connectionType: 'provider' };
    }
    
    // 关键修复：如果正在连接，复用现有的连接 Promise
    if (isConnecting && connectionPromise) {
      console.log('[Connection Handler] Connection in progress, reusing existing promise');
      return connectionPromise;
    }
    
    // 如果已连接，先验证连接状态
    if (connection?.isConnected) {
      console.log('[Connection Handler] Already connected and verified, returning success');
      notifyRenderer('acp:status', { status: 'connected' });
      return { success: true, alreadyConnected: true, connectionType };
    }
    
    // 如果连接对象存在但未连接，先清理
    if (connection && !connection.isConnected) {
      console.log('[Connection Handler] Connection exists but not connected, cleaning up...');
      try {
        await connection.disconnect();
      } catch (e) {
        console.error('[Connection Handler] Error disconnecting old connection:', e);
      }
      connection = null;
      acpConnection = null;
      connectionType = null;
    }
    
    // 开始新连接
    isConnecting = true;
    connectionPromise = doConnect(mode);
    
    try {
      const result = await connectionPromise;
      return result;
    } finally {
      isConnecting = false;
      connectionPromise = null;
    }
  });
  
  // 提取连接逻辑为独立函数
  async function doConnect(mode: 'sdk' | 'acp' | 'provider' | undefined): Promise<{ success: boolean; connectionType?: string; alreadyConnected?: boolean; error?: string }> {
    console.log('[Connection Handler] doConnect started, mode:', mode);
    
    try {
      const factory = ConnectionFactory.getInstance();
      
      // 如果已经有连接实例但状态不对，断开旧连接
      if (connection) {
        const state = connection.currentState;
        if (state === 'error' || state === 'disconnected') {
          console.log('[Connection Handler] Disconnecting old connection in state:', state);
          await factory.destroy();
          connection = null;
          acpConnection = null;
          connectionType = null;
        }
      }

      // 根据用户选择的模式决定连接类型
      // 'sdk' → 强制使用 SDK（失败不降级）
      // 'acp' → 强制使用 ACP WebSocket
      // 默认 → 'auto'（SDK 优先，失败降级 ACP）
      let connectionTypeOption: 'sdk' | 'acp' | 'auto';
      
      if (connectionMode === 'sdk') {
        connectionTypeOption = 'sdk';
        console.log('[Connection Handler] Using SDK mode (forced, no fallback)');
      } else if (connectionMode === 'acp') {
        connectionTypeOption = 'acp';
        console.log('[Connection Handler] Using ACP mode (forced)');
      } else {
        connectionTypeOption = 'auto';
        console.log('[Connection Handler] Using auto mode (SDK with ACP fallback)');
      }
      
      console.log('[Connection Handler] Creating new connection via ConnectionFactory, type:', connectionTypeOption);
      
      // 获取当前session的工作目录（优先级最高）
      let sessionWorkingDir = '';
      if (currentSessionId) {
        const currentSession = sessionStore.loadSession(currentSessionId);
        if (currentSession?.workingDir) {
          sessionWorkingDir = currentSession.workingDir;
          console.log('[Connection Handler] Using session workingDir:', sessionWorkingDir);
        }
      }
      
      // 降级获取：settings中的workspacePath
      if (!sessionWorkingDir) {
        const settings = readSettingsJson();
        sessionWorkingDir = (settings.workspacePath as string) || process.cwd();
        console.log('[Connection Handler] Using settings/fallback workingDir:', sessionWorkingDir);
      }
      
      // 使用 ConnectionFactory 创建连接，传递 workingDir
      // 注意：createConnection() 内部已调用 connect()，无需重复调用
      const result = await factory.createConnection({ 
        type: connectionTypeOption,
        sdk: { workingDir: sessionWorkingDir }
      });
      
      connection = result.connection;
      connectionType = result.type;
      
      console.log('[Connection Handler] Connection created, type:', result.type, 'fallback:', result.fallback);
      
      // 进行协议初始化握手（如果连接支持）- 关键修复：先初始化，再通知
      console.log('[Connection Handler] Calling initialize()...');
      try {
        await connection.initialize();
        console.log('[Connection Handler] Initialization completed successfully');
      } catch (initError) {
        console.log('[Connection Handler] Initialize warning:', initError);
        // 初始化失败不一定影响连接，继续执行
      }
      
      // 设置事件处理（连接后设置，同时发送初始状态）
      setupConnectionEventHandlers(connection, window);
      
      // 验证连接状态（确保初始化后连接仍然可用）
      if (!connection.isConnected) {
        const state = connection.currentState;
        console.error('[Connection Handler] Connection lost after initialization, state:', state);
        throw new Error(`Connection lost during initialization, state: ${state}`);
      }
      
      // 初始化完成后再通知前端 - 关键修复
      console.log('[Connection Handler] Sending connected status to renderer, connection state:', connection.currentState);
      notifyRenderer('acp:status', { status: 'connected' });
      console.log('[Connection Handler] Connected status sent, waiting for renderer to acknowledge...');
      
      // 如果是 ACP 连接，保存引用以便特定功能使用
      if (result.type === 'acp') {
        acpConnection = result.connection as AcpConnection;
        console.log('[Connection Handler] ACP connection reference saved');
      }
      
      console.log('[Connection Handler] Connection fully established and ready!');

      return { 
        success: true, 
        connectionType: result.type
      };
    } catch (error) {
      console.error('[Connection Handler] Connect error:', error);
      connection?.disconnect();
      connection = null;
      acpConnection = null;
      connectionType = null;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  ipcMain.handle('acp:disconnect', async () => {
    try {
      if (acpConnection) {
        await acpConnection.disconnect();
        acpConnection = null;
      }
      if (connection) {
        await connection.disconnect();
        connection = null;
        connectionType = null;
      }
      currentStreamingMessageId = null;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('acp:sendPrompt', async (_event, { prompt, attachments, aiMessageId }: { prompt: string; attachments?: Array<{ type: string; name: string; content?: string; path?: string }>; aiMessageId?: string }) => {
    console.log('[Handler] acp:sendPrompt called, prompt:', prompt?.substring(0, 50), 'aiMessageId:', aiMessageId);
    try {
      const conn = getConnection();
      console.log('[Handler] getConnection returned:', conn ? 'exists' : 'null', 'state:', conn?.currentState, 'isConnected:', conn?.isConnected);
      
      if (!currentSessionId) {
        console.log('[Handler] No active session, currentSessionId:', currentSessionId);
        throw new Error('No active session');
      }

      // Add user message to session
      const userMessage: Omit<Message, 'id' | 'timestamp'> = {
        role: 'user',
        content: prompt,
        attachments,
      };
      sessionStore.addMessage(currentSessionId, userMessage);

      // Create placeholder for assistant response
      // 如果渲染进程提供了 aiMessageId，使用它；否则自己生成
      const assistantMessage = sessionStore.addMessage(currentSessionId, {
        role: 'assistant',
        content: '',
        isStreaming: true,
        id: aiMessageId, // 使用渲染进程提供的 ID
      });

      if (assistantMessage) {
        const lastMessage = assistantMessage.messages[assistantMessage.messages.length - 1];
        currentStreamingMessageId = lastMessage.id;
        console.log('[Handler] Set currentStreamingMessageId:', currentStreamingMessageId);
      }

      // Send prompt to ACP
      const sessionId = conn.currentSessionId;
      if (!sessionId) {
        throw new Error('No active ACP session');
      }
      
      // Convert prompt string to array format required by iflow cli
      const promptContent = [{ type: 'text' as const, text: prompt }];

      // 添加重试机制：处理 peer 未就绪的情况
      const maxRetries = 2;
      let lastError = null;
      let result = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[Handler] Attempt ${attempt}/${maxRetries} to send prompt`);
          result = await conn.sendPrompt({
            sessionId,
            prompt: promptContent,
            attachments: attachments && attachments.length > 0 
              ? attachments.filter((a): a is { type: string; name: string; content: string } => !!a.content)
              : undefined
          });
          console.log(`[Handler] Prompt sent successfully on attempt ${attempt}`);
          break;
        } catch (error) {
          lastError = error;
          console.error(`[Handler] Prompt failed on attempt ${attempt}:`, error);

          if (attempt < maxRetries) {
            console.log(`[Handler] Retrying in 1 second...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      if (!result) {
        throw lastError || new Error('Failed to send prompt after retries');
      }

      return { success: true, data: result, aiMessageId: currentStreamingMessageId };
    } catch (error) {
      console.error('[Handler] acp:sendPrompt final error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('acp:setMode', async (_event, { mode }: { mode: SupportedMode }) => {
    try {
      const conn = getConnection();
      const result = await conn.setMode({ mode });
      
      // Update session settings
      if (currentSessionId) {
        const session = sessionStore.loadSession(currentSessionId);
        if (session) {
          session.settings = { ...session.settings, mode };
          sessionStore.saveSession(session);
        }
      }
      
      // 持久化到 settings.json
      updateSettingsJson({ defaultMode: mode });
      
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('acp:setModel', async (_event, { model }: { model: SupportedModel }) => {
    try {
      const conn = getConnection();
      const result = await conn.setModel({ model });
      
      // Update session settings
      if (currentSessionId) {
        const session = sessionStore.loadSession(currentSessionId);
        if (session) {
          session.settings = { ...session.settings, model };
          sessionStore.saveSession(session);
        }
      }
      
      // 持久化到 settings.json
      updateSettingsJson({ modelName: model });
      
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('acp:setDeepThinking', async (_event, { enabled, level }: { enabled: boolean; level?: number }) => {
    try {
      const conn = getConnection();
      const result = await conn.setDeepThinking({ enabled, level });
      
      // Update session settings
      if (currentSessionId) {
        const session = sessionStore.loadSession(currentSessionId);
        if (session) {
          session.settings = { 
            ...session.settings, 
            deepThinking: enabled,
            deepThinkingLevel: level,
          };
          sessionStore.saveSession(session);
        }
      }
      
      // 持久化到 settings.json
      const deepThinkingSettings: Record<string, unknown> = { deepThinking: enabled };
      if (level !== undefined) {
        deepThinkingSettings.deepThinkingLevel = level;
      }
      updateSettingsJson(deepThinkingSettings);
      
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // 设置工作区
  ipcMain.handle('acp:setWorkspace', async (_event, { path }: { path: string }) => {
    try {
      // 更新当前会话的工作区
      if (currentSessionId) {
        const session = sessionStore.loadSession(currentSessionId);
        if (session) {
          session.workingDir = path;
          sessionStore.saveSession(session);
          console.log('[IPC] Updated session working directory:', path);
        }
      }
      
      // 持久化到 settings.json
      updateSettingsJson({ workspacePath: path });
      
      // 关键修复：工作区切换后需要断开并重新创建连接
      // 否则 iFlow CLI 进程仍使用旧的 workingDir
      if (connection && connection.isConnected) {
        console.log('[IPC] Workspace changed, disconnecting old connection...');
        try {
          if (acpConnection) {
            await acpConnection.disconnect();
            acpConnection = null;
          }
          if (connection) {
            await connection.disconnect();
            connection = null;
            connectionType = null;
          }
          console.log('[IPC] Old connection disconnected, will reconnect with new workspace');
        } catch (e) {
          console.error('[IPC] Error disconnecting old connection:', e);
        }
        
        // 触发重新连接（使用新的 workingDir）
        // 这里使用 setTimeout 延迟执行，确保断开完成
        setTimeout(async () => {
          try {
            const connectResult = await doConnect(connectionMode, null as any);
            console.log('[IPC] Reconnected with new workspace:', connectResult);
          } catch (e) {
            console.error('[IPC] Failed to reconnect after workspace change:', e);
          }
        }, 100);
      }
      
      return { success: true, data: { path } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('acp:getSettings', async () => {
    try {
      const conn = getConnection();
      return {
        success: true,
        data: {
          mode: conn.getCurrentMode(),
          model: conn.getCurrentModel(),
          deepThinking: conn.isDeepThinkingEnabled(),
          deepThinkingLevel: conn.getDeepThinkingLevel(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // ========================================================================
  // Provider Management Handlers
  // ========================================================================

  ipcMain.handle('provider:list', async () => {
    try {
      const mgr = getProviderMgr();
      const providers = mgr.getAllProviders();
      return { success: true, data: providers };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('provider:getActive', async () => {
    try {
      const mgr = getProviderMgr();
      const provider = mgr.getActiveProvider();
      const model = mgr.getActiveModel();
      return {
        success: true,
        data: {
          provider,
          model,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('provider:setActive', async (_event, { providerId, modelId }: { providerId: string; modelId?: string }) => {
    try {
      const mgr = getProviderMgr();
      await mgr.setActiveProvider(providerId);
      if (modelId) {
        mgr.setActiveModel(modelId);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('provider:setApiKey', async (_event, { providerId, apiKey }: { providerId: string; apiKey: string }) => {
    try {
      const mgr = getProviderMgr();
      const success = mgr.setApiKey(providerId, apiKey);
      return { success };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('provider:setModel', async (_event, { modelId }: { modelId: string }) => {
    try {
      const mgr = getProviderMgr();
      const success = mgr.setActiveModel(modelId);
      return { success };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('provider:add', async (_event, { provider }: { provider: ModelProvider }) => {
    try {
      const mgr = getProviderMgr();
      const result = mgr.addProvider(provider);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('provider:remove', async (_event, { providerId }: { providerId: string }) => {
    try {
      const mgr = getProviderMgr();
      const success = mgr.removeProvider(providerId);
      return { success };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('provider:sync', async (_event, { providers, activeProviderId, activeModelId, apiKeys }: {
    providers?: ModelProvider[];
    activeProviderId?: string;
    activeModelId?: string;
    apiKeys?: Record<string, string>;
  }) => {
    try {
      const mgr = getProviderMgr();
      
      // Import configuration
      mgr.importConfig({
        activeProviderId,
        activeModelId,
        customProviders: providers?.filter(p => !p.isPreset) || [],
        apiKeys: apiKeys || {},
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // ========================================================================
  // Provider Chat Handler (Streaming)
  // ========================================================================

  ipcMain.handle('provider:sendPrompt', async (_event, { messages, options }: {
    messages: ChatMessage[];
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    };
  }) => {
    try {
      if (!currentSessionId) {
        throw new Error('No active session');
      }

      const mgr = getProviderMgr();
      
      // Create placeholder for assistant response
      const assistantMessage = sessionStore.addMessage(currentSessionId, {
        role: 'assistant',
        content: '',
        isStreaming: true,
      });

      let messageId: string | null = null;
      if (assistantMessage) {
        const lastMessage = assistantMessage.messages[assistantMessage.messages.length - 1];
        messageId = lastMessage.id;
        currentStreamingMessageId = messageId;
      }

      // Start streaming
      const stream = mgr.chatStream(messages, options);
      let fullContent = '';

      for await (const chunk of stream) {
        if (chunk.type === 'content' && chunk.content) {
          fullContent += chunk.content;
          
          // Notify renderer of chunk
          notifyRenderer('provider:chunk', {
            messageId,
            content: chunk.content,
            fullContent,
          });

          // Update session store
          if (messageId) {
            sessionStore.updateMessage(currentSessionId, messageId, {
              content: fullContent,
            });
          }
        } else if (chunk.type === 'thought' && chunk.thought) {
          // Notify renderer of thought
          notifyRenderer('provider:thought', {
            messageId,
            thought: chunk.thought,
          });
        } else if (chunk.type === 'usage' && chunk.usage) {
          // Notify renderer of usage
          notifyRenderer('provider:usage', {
            messageId,
            usage: chunk.usage,
          });
        } else if (chunk.type === 'error') {
          // Handle error
          notifyRenderer('provider:error', {
            messageId,
            error: chunk.error,
          });
          
          if (messageId) {
            sessionStore.updateMessage(currentSessionId, messageId, {
              isStreaming: false,
              metadata: { finishReason: 'error' },
            });
          }
          
          currentStreamingMessageId = null;
          return {
            success: false,
            error: chunk.error?.message || 'Unknown error',
          };
        } else if (chunk.type === 'done') {
          // Streaming complete
          notifyRenderer('provider:done', {
            messageId,
            finishReason: chunk.finishReason,
          });

          if (messageId) {
            sessionStore.updateMessage(currentSessionId, messageId, {
              isStreaming: false,
              metadata: { finishReason: chunk.finishReason || 'stop' },
            });
          }
          
          currentStreamingMessageId = null;
        }
      }

      return { success: true, data: { content: fullContent } };
    } catch (error) {
      currentStreamingMessageId = null;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // ========================================================================
  // Session Management Handlers
  // ========================================================================

  ipcMain.handle('session:list', async () => {
    try {
      const sessions = sessionStore.loadAllSessions();
      return { success: true, data: sessions };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('session:create', async (_event, { title, workingDir, settings }: { title?: string; workingDir?: string; settings?: Session['settings'] }) => {
    try {
      const conn = getConnection();
      
      // Merge settings: connection defaults + frontend overrides
      // Frontend settings take priority (user's current selection)
      const mergedSettings = {
        mode: conn.getCurrentMode(),
        model: conn.getCurrentModel(),
        deepThinking: conn.isDeepThinkingEnabled(),
        deepThinkingLevel: conn.getDeepThinkingLevel(),
        ...settings,  // Frontend settings override defaults
      };
      const mergedWorkingDir = workingDir || process.cwd();
      
      console.log('[Session] Creating session with settings:', {
        workingDir: mergedWorkingDir,
        connectionDefaults: {
          mode: conn.getCurrentMode(),
          model: conn.getCurrentModel(),
        },
        frontendSettings: settings,
        mergedSettings,
      });
      
      // Create new session
      const acpResult = await conn.newSession({
        workingDir: mergedWorkingDir,
        options: mergedSettings
      });

      if (!acpResult.sessionId) {
        throw new Error('Failed to create session');
      }

      // Create local session
      const session = sessionStore.createSession(
        title || 'New Chat',
        mergedWorkingDir,
        mergedSettings
      );

      currentSessionId = session.id;
      
      return { success: true, data: session };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('session:load', async (_event, { sessionId, title, workingDir, settings }: { sessionId: string; title?: string; workingDir?: string; settings?: Session['settings'] }) => {
    console.log('[session:load] Called with:', { sessionId, title, workingDir, settings });
    try {
      // 如果当前会话就是目标会话，跳过重新加载
      if (currentSessionId === sessionId) {
        console.log('[Session] Session already loaded:', sessionId);
        const session = sessionStore.loadSession(sessionId);
        return { success: true, data: session, alreadyLoaded: true };
      }
      
      // 检查是否正在加载同一会话
      const pending = pendingSessionLoads.get(sessionId);
      if (pending) {
        console.log('[Session] Session load in progress, waiting:', sessionId);
        return pending;
      }
      
      // 创建加载 Promise
      const loadPromise = (async () => {
        try {
          // 关键修复：在加载会话前检查连接状态
          // 如果连接未建立或已断开，尝试重新连接
          if (!connection || !connection.isConnected) {
            console.log('[session:load] Connection not ready, attempting to reconnect...');
            
            // 使用已有的连接逻辑重新连接
            const reconnectPromise = doConnect(connectionMode, window);
            const reconnectResult = await reconnectPromise;
            
            if (!reconnectResult.success) {
              throw new Error(`Failed to establish connection: ${reconnectResult.error}`);
            }
            
            console.log('[session:load] Reconnected successfully, type:', reconnectResult.connectionType);
          }
          
          let session = sessionStore.loadSession(sessionId);
          
          // If session doesn't exist, create it
          if (!session) {
            console.log(`[Session] Creating new session: ${sessionId}`);
            session = sessionStore.createSession(
              title || '新会话',
              workingDir || process.cwd(),
              settings
            );
            // Override the generated id with the one from frontend
            session.id = sessionId;
            sessionStore.saveSession(session);
          }

          // 关键修复：每次调用 newSession 前重新获取连接并验证状态
          // 避免 conn 对象内部状态已经改变但外部未同步的情况
          if (!connection || !connection.isConnected) {
            console.log('[session:load] Connection state changed during load, re-validating...');
            throw new Error('Connection state changed, aborting load');
          }
          
          const conn = connection;
          
          // Merge settings: session defaults + frontend overrides
          // Frontend settings take priority (user's current selection)
          const mergedSettings = {
            ...session.settings,
            ...settings,
          };
          const mergedWorkingDir = workingDir || session.workingDir || process.cwd();
          
          // 验证 workingDir 是否有效
          if (!mergedWorkingDir) {
            console.error('[session:load] workingDir is empty, using process.cwd() as fallback');
          }
          console.log('[session:load] Using workingDir:', mergedWorkingDir);
          
          console.log('[Session] Loading session with settings:', {
            sessionId,
            workingDir: mergedWorkingDir,
            sessionSettings: session.settings,
            frontendSettings: settings,
            mergedSettings,
            connectionState: conn.currentState,
          });
          
          // Update session with merged values
          session.workingDir = mergedWorkingDir;
          session.settings = mergedSettings;
          sessionStore.saveSession(session);
          
          // Create new session with merged settings
          // 添加重试机制，处理临时性的连接问题
          let acpResult: Awaited<ReturnType<typeof conn.newSession>> | null = null;
          let newSessionError: Error | null = null;
          const maxRetries = 2;
          
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              console.log(`[session:load] Attempt ${attempt}/${maxRetries} to call newSession`);
              
              // 在调用前再次验证连接状态
              if (!conn.isConnected) {
                throw new Error(`Connection not ready, state: ${conn.currentState}`);
              }
              
              acpResult = await conn.newSession({
                sessionId,
                workingDir: mergedWorkingDir,
                options: mergedSettings
              });
              
              // 成功则跳出循环
              console.log(`[session:load] newSession succeeded on attempt ${attempt}`);
              break;
            } catch (error) {
              newSessionError = error instanceof Error ? error : new Error(String(error));
              console.error(`[session:load] newSession failed on attempt ${attempt}:`, newSessionError.message);
              
              // 检查是否是连接错误
              const isConnectionError = 
                newSessionError.message.includes('Not connected') ||
                newSessionError.message.includes('connection') ||
                newSessionError.message.includes('ECONNREFUSED') ||
                newSessionError.message.includes('WebSocket');
              
              if (isConnectionError && attempt < maxRetries) {
                console.log(`[session:load] Connection error detected, will retry...`);
                // 等待一下再重试
                await new Promise(resolve => setTimeout(resolve, 1000));
              } else {
                // 非连接错误或已达最大重试次数，直接抛出
                break;
              }
            }
          }
          
          if (!acpResult) {
            throw newSessionError || new Error('Failed to create session after retries');
          }
          
          console.log('[session:load] newSession result:', JSON.stringify(acpResult));
          
          // Check for sessionId in response (iflow cli returns sessionId on success)
          if (!acpResult.sessionId) {
            console.error('[session:load] newSession returned invalid result:', JSON.stringify(acpResult));
            
            // 如果是因为连接问题导致的失败，尝试重新连接一次
            const errorMsg = acpResult.error || 'Unknown error';
            if (errorMsg.includes('Not connected') || errorMsg.includes('connection') || errorMsg.includes('ECONNREFUSED')) {
              console.log('[session:load] Detected connection error, attempting reconnect...');
              
              try {
                const reconnectPromise = doConnect(connectionMode, window);
                const reconnectResult = await reconnectPromise;
                
                if (reconnectResult.success) {
                  console.log('[session:load] Reconnected successfully, retrying newSession...');
                  const retryResult = await conn.newSession({
                    sessionId,
                    workingDir: mergedWorkingDir,
                    options: mergedSettings
                  });
                  
                  if (retryResult.sessionId) {
                    console.log('[session:load] newSession succeeded after reconnect');
                    currentSessionId = sessionId;
                    currentStreamingMessageId = null;
                    return { success: true, data: session };
                  }
                }
              } catch (reconnectError) {
                console.error('[session:load] Reconnect failed:', reconnectError);
              }
            }
            
            throw new Error(acpResult.error || `Failed to create session: sessionId is empty. Result: ${JSON.stringify(acpResult)}`);
          }

          currentSessionId = sessionId;
          currentStreamingMessageId = null;
          
          return { success: true, data: session };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error('[session:load] Failed:', errorMsg, error);
          
          return {
            success: false,
            error: errorMsg,
          };
        } finally {
          // 清理 pending 状态
          pendingSessionLoads.delete(sessionId);
        }
      })();
      
      // 记录 pending 状态
      pendingSessionLoads.set(sessionId, loadPromise);
      
      return loadPromise;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('session:delete', async (_event, { sessionId }) => {
    try {
      const success = sessionStore.deleteSession(sessionId);
      
      if (currentSessionId === sessionId) {
        currentSessionId = null;
        currentStreamingMessageId = null;
      }
      
      return { success };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('session:updateTitle', async (_event, { sessionId, title }) => {
    try {
      const session = sessionStore.updateSessionTitle(sessionId, title);
      return { success: true, data: session };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('session:addMessage', async (_event, { sessionId, message }) => {
    try {
      const session = sessionStore.addMessage(sessionId, message);
      return { success: true, data: session };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('session:clearAll', async () => {
    try {
      sessionStore.clearAllSessions();
      currentSessionId = null;
      currentStreamingMessageId = null;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('session:getCurrent', async () => {
    try {
      if (!currentSessionId) {
        return { success: true, data: null };
      }
      const session = sessionStore.loadSession(currentSessionId);
      return { success: true, data: session };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('session:setCurrent', async (_event, { sessionId }) => {
    try {
      const session = sessionStore.loadSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }
      currentSessionId = sessionId;
      currentStreamingMessageId = null;
      return { success: true, data: session };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}

// ============================================================================
// Cleanup
// ============================================================================

export function unregisterIpcHandlers(): void {
  console.log('[IPC] Unregistering all IPC handlers and cleaning up resources...');
  
  // Remove all ipcMain handlers
  const channels = [
    'connection:getType',
    'connection:setMode',
    'acp:connect',
    'acp:disconnect',
    'acp:sendPrompt',
    'acp:setMode',
    'acp:setModel',
    'acp:setDeepThinking',
    'acp:getSettings',
    'provider:list',
    'provider:getActive',
    'provider:setActive',
    'provider:setApiKey',
    'provider:setModel',
    'provider:add',
    'provider:remove',
    'provider:sync',
    'provider:sendPrompt',
    'session:list',
    'session:create',
    'session:load',
    'session:delete',
    'session:updateTitle',
    'session:addMessage',
    'session:clearAll',
    'session:getCurrent',
    'session:setCurrent',
  ];

  for (const channel of channels) {
    ipcMain.removeHandler(channel);
  }

  // Disconnect and cleanup ACP connection
  if (acpConnection) {
    // 移除所有事件监听器，防止内存泄漏
    acpConnection.removeAllListeners();
    acpConnection.disconnect();
    acpConnection = null;
  }

  // Cleanup unified connection
  if (connection) {
    connection.removeAllListeners();
    connection.disconnect();
    connection = null;
    connectionType = null;
  }

  // Cleanup Provider Manager
  if (providerManager) {
    providerManager.destroy();
    providerManager = null;
  }
  
  // 清除 BrowserWindow 引用
  mainWindowRef = null;
  
  currentSessionId = null;
  currentStreamingMessageId = null;
  
  console.log('[IPC] Cleanup completed');
}