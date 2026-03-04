/**
 * IPC Handlers
 * Bridge between renderer process and main process
 */

import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { AcpConnection } from '../acp/connection';
import { sessionStore, Session, Message } from '../store/sessions';
import {
  SessionUpdate,
  SupportedMode,
  SupportedModel,
  AgentMessageChunkData,
  AgentThoughtChunkData,
  ToolCallData,
  ToolResultData,
  PlanData,
  PlanProgressData,
  ErrorData,
  CompleteData,
} from '../acp/types';

// ============================================================================
// ACP Connection Instance
// ============================================================================

let acpConnection: AcpConnection | null = null;
let currentSessionId: string | null = null;
let currentStreamingMessageId: string | null = null;

// ============================================================================
// Helper Functions
// ============================================================================

function getAcpConnection(): AcpConnection {
  console.log('[ACP Handler] getAcpConnection called, acpConnection exists:', !!acpConnection, 'isConnected:', acpConnection?.isConnected);
  if (!acpConnection) {
    console.error('[ACP Handler] acpConnection is null!');
    throw new Error('ACP not connected');
  }
  return acpConnection;
}

function notifyRenderer(window: BrowserWindow, channel: string, ...args: unknown[]): void {
  if (!window.isDestroyed()) {
    window.webContents.send(channel, ...args);
  }
}

// ============================================================================
// ACP Event Handlers
// ============================================================================

function setupAcpEventHandlers(connection: AcpConnection, window: BrowserWindow): void {
  // Handle session updates (streaming responses)
  connection.on('update', (update: SessionUpdate) => {
    handleSessionUpdate(update, window);
  });

  // Handle connection events
  connection.on('connected', () => {
    notifyRenderer(window, 'acp:status', { status: 'connected' });
  });

  connection.on('disconnected', () => {
    notifyRenderer(window, 'acp:status', { status: 'disconnected' });
    currentStreamingMessageId = null;
  });

  connection.on('error', (error: Error) => {
    notifyRenderer(window, 'acp:status', { status: 'error', error: error.message });
    currentStreamingMessageId = null;
  });

  connection.on('stateChange', (state: string) => {
    notifyRenderer(window, 'acp:state', { state });
  });

  connection.on('stderr', (data: string) => {
    notifyRenderer(window, 'acp:stderr', { data });
  });
}

function handleSessionUpdate(update: SessionUpdate, window: BrowserWindow): void {
  console.log('[ACP Handler] handleSessionUpdate called:', JSON.stringify(update, null, 2));
  
  // Forward update to renderer
  notifyRenderer(window, 'acp:update', update);
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
        if (content && content.text && currentStreamingMessageId) {
          sessionStore.appendMessageContent(
            currentSessionId,
            currentStreamingMessageId,
            content.text,
            false // For AionUi, we'll handle completion differently
          );
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
        const data = update.data as ToolResultData;
        // Tool result is handled by the UI
        break;
      }

      case 'plan': {
        const data = update.data as PlanData;
        // Plan is displayed in UI, not persisted as message
        break;
      }

      case 'plan_progress': {
        const data = update.data as PlanProgressData;
        // Plan progress is displayed in UI
        break;
      }

      case 'error': {
        const data = update.data as ErrorData;
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
  // ========================================================================
  // ACP Connection Handlers
  // ========================================================================

  ipcMain.handle('acp:connect', async () => {
    console.log('[ACP Handler] acp:connect called, current acpConnection:', !!acpConnection);
    try {
      // 如果已经有连接实例
      if (acpConnection) {
        // 已连接成功，直接返回
        if (acpConnection.isConnected) {
          console.log('[ACP Handler] Already connected, returning success');
          return { success: true, alreadyConnected: true };
        }
        // 正在连接中，等待连接完成
        if (acpConnection.currentState === 'connecting' || acpConnection.currentState === 'initializing') {
          console.log('[ACP Handler] Connection already in progress, waiting...');
          // 等待连接完成
          return new Promise((resolve) => {
            const timeout = setTimeout(() => {
              console.log('[ACP Handler] Connection wait timeout');
              resolve({ success: false, error: 'Connection timeout' });
            }, 15000);
            
            acpConnection!.once('connected', () => {
              console.log('[ACP Handler] Received connected event');
              clearTimeout(timeout);
              resolve({ success: true });
            });
            
            acpConnection!.once('error', (err) => {
              console.log('[ACP Handler] Received error event:', err);
              clearTimeout(timeout);
              resolve({ success: false, error: err instanceof Error ? err.message : 'Connection failed' });
            });
          });
        }
        // 其他状态（如 error），断开旧连接
        console.log('[ACP Handler] Disconnecting old connection in state:', acpConnection.currentState);
        await acpConnection.disconnect();
        acpConnection = null;
      }

      console.log('[ACP Handler] Creating new AcpConnection...');
      acpConnection = new AcpConnection();
      setupAcpEventHandlers(acpConnection, window);
      
      console.log('[ACP Handler] Calling connect()...');
      await acpConnection.connect();
      
      console.log('[ACP Handler] Calling initialize()...');
      // 进行 ACP 协议初始化握手
      await acpConnection.initialize();
      
      console.log('[ACP Handler] Connection fully established!');

      return { success: true };
    } catch (error) {
      console.error('[ACP Handler] Connect error:', error);
      acpConnection?.disconnect();
      acpConnection = null;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('acp:disconnect', async () => {
    try {
      if (acpConnection) {
        await acpConnection.disconnect();
        acpConnection = null;
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

  ipcMain.handle('acp:sendPrompt', async (_event, { prompt, attachments }) => {
    try {
      const connection = getAcpConnection();
      
      if (!currentSessionId) {
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
      const assistantMessage = sessionStore.addMessage(currentSessionId, {
        role: 'assistant',
        content: '',
        isStreaming: true,
      });

      if (assistantMessage) {
        const lastMessage = assistantMessage.messages[assistantMessage.messages.length - 1];
        currentStreamingMessageId = lastMessage.id;
      }

      // Send prompt to ACP
      const sessionId = connection.sessionId;
      if (!sessionId) {
        throw new Error('No active ACP session');
      }
      
      // Convert prompt string to array format required by iflow cli
      const promptContent = [{ type: 'text' as const, text: prompt }];
      
      const result = await connection.prompt({ 
        sessionId,
        prompt: promptContent, 
        attachments: attachments && attachments.length > 0 ? attachments : undefined 
      });
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('acp:setMode', async (_event, { mode }: { mode: SupportedMode }) => {
    try {
      const connection = getAcpConnection();
      const result = await connection.setMode({ mode });
      
      // Update session settings
      if (currentSessionId) {
        const session = sessionStore.loadSession(currentSessionId);
        if (session) {
          session.settings = { ...session.settings, mode };
          sessionStore.saveSession(session);
        }
      }
      
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
      const connection = getAcpConnection();
      const result = await connection.setModel({ model });
      
      // Update session settings
      if (currentSessionId) {
        const session = sessionStore.loadSession(currentSessionId);
        if (session) {
          session.settings = { ...session.settings, model };
          sessionStore.saveSession(session);
        }
      }
      
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
      const connection = getAcpConnection();
      const result = await connection.setDeepThinking({ enabled, level });
      
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
      
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle('acp:getSettings', async () => {
    try {
      const connection = getAcpConnection();
      return {
        success: true,
        data: {
          mode: connection.getCurrentMode(),
          model: connection.getCurrentModel(),
          deepThinking: connection.isDeepThinkingEnabled(),
          deepThinkingLevel: connection.getDeepThinkingLevel(),
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

  ipcMain.handle('session:create', async (_event, { title, workingDir }) => {
    try {
      const connection = getAcpConnection();
      
      // Create new ACP session
      const acpResult = await connection.newSession({
        workingDir: workingDir || process.cwd(),
        options: {
          mode: connection.getCurrentMode(),
          model: connection.getCurrentModel(),
          deepThinking: connection.isDeepThinkingEnabled(),
          deepThinkingLevel: connection.getDeepThinkingLevel(),
        }
      });

      if (acpResult.status !== 'created') {
        throw new Error(acpResult.error || 'Failed to create ACP session');
      }

      // Create local session
      const session = sessionStore.createSession(
        title || 'New Chat',
        workingDir || process.cwd(),
        {
          mode: connection.getCurrentMode(),
          model: connection.getCurrentModel(),
          deepThinking: connection.isDeepThinkingEnabled(),
          deepThinkingLevel: connection.getDeepThinkingLevel(),
        }
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
    try {
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

      const connection = getAcpConnection();
      
      // Create new ACP session with the same working directory
      const acpResult = await connection.newSession({
        sessionId,
        workingDir: session.workingDir,
        options: session.settings
      });
      
      // Check for sessionId in response (iflow cli returns sessionId on success)
      if (!acpResult.sessionId) {
        throw new Error(acpResult.error || 'Failed to create ACP session');
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
    'acp:connect',
    'acp:disconnect',
    'acp:sendPrompt',
    'acp:setMode',
    'acp:setModel',
    'acp:setDeepThinking',
    'acp:getSettings',
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
  
  currentSessionId = null;
  currentStreamingMessageId = null;
  
  console.log('[IPC] Cleanup completed');
}
