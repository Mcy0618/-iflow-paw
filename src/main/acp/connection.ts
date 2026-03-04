/**
 * ACP Connection Manager
 * Handles JSON-RPC 2.0 communication with iFlow CLI via WebSocket
 */

import { spawn, ChildProcess, exec, execSync } from 'child_process';
import * as fs from 'fs';
import * as net from 'net';
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  AcpConnectionState,
  AcpConnectionOptions,
  ACP_METHODS,
  AcpInitializeParams,
  AcpInitializeResult,
  AcpNewSessionParams,
  AcpNewSessionResult,
  AcpPromptParams,
  AcpPromptResult,
  AcpSetModeParams,
  AcpSetModeResult,
  AcpSetModelParams,
  AcpSetModelResult,
  AcpSetDeepThinkingParams,
  AcpSetDeepThinkingResult,
  SessionUpdate,
  SupportedMode,
  SupportedModel,
} from './types';

// Generate unique ID for JSON-RPC requests
let requestIdCounter = 0;
function generateRequestId(): string {
  return `req_${++requestIdCounter}_${Date.now()}`;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
}

export class AcpConnection extends EventEmitter {
  private process: ChildProcess | null = null;
  private ws: WebSocket | null = null;
  private state: AcpConnectionState = 'disconnected';
  private pendingRequests = new Map<string, PendingRequest>();
  private sessionId: string | null = null;
  private options: Required<AcpConnectionOptions>;

  constructor(options: AcpConnectionOptions = {}) {
    super();
    this.options = {
      port: options.port || 8090,
      host: options.host || 'localhost',
    };
  }

  // ========================================================================
  // Connection Lifecycle
  // ========================================================================

  /**
   * 检测指定端口是否已被占用
   */
  private checkPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(2000);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.connect(port, '127.0.0.1');
    });
  }

  async connect(): Promise<void> {
    if (this.state !== 'disconnected') {
      throw new Error(`Cannot connect: current state is ${this.state}`);
    }

    this.setState('connecting');

    try {
      // 先检测端口是否已被占用
      const portInUse = await this.checkPortInUse(this.options.port);
      
      if (portInUse) {
        // 端口已被占用，尝试复用已有连接
        console.log(`[ACP] Port ${this.options.port} already in use, attempting to reuse existing connection`);
        // 添加重试机制，等待服务器就绪
        let connected = false;
        for (let i = 0; i < 5; i++) {
          try {
            await this.connectWebSocket();
            connected = true;
            break;
          } catch (error) {
            console.log(`[ACP] Connection attempt ${i + 1} failed, retrying in ${(i + 1) * 500}ms...`);
            await new Promise(resolve => setTimeout(resolve, (i + 1) * 500));
          }
        }
        if (!connected) {
          throw new Error('Failed to connect to existing ACP server after 5 attempts');
        }
      } else {
        // 启动新进程
        await this.spawnProcess();
        await this.connectWebSocket();
      }
      
      // 等待 //ready 消息
      await new Promise<void>((resolve) => {
        const handler = (message: string) => {
          if (message === 'ready') {
            this.off('ready', handler);
            resolve();
          }
        };
        this.on('ready', handler);
        
        // 超时保护
        setTimeout(() => {
          this.off('ready', handler);
          resolve(); // 即使没有收到 ready 消息也继续
        }, 5000);
      });
      
      this.setState('connected');
      this.emit('connected');
    } catch (error) {
      this.setState('error');
      this.emit('error', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // Close WebSocket connection
    if (this.ws) {
      // 检查 WebSocket 状态，避免在 CONNECTING 状态下调用 close()
      const readyState = this.ws.readyState;
      
      // 移除所有 WebSocket 监听器，防止内存泄漏
      this.ws.removeAllListeners();
      
      if (readyState === WebSocket.OPEN || readyState === WebSocket.CLOSING) {
        this.ws.close();
      } else if (readyState === WebSocket.CONNECTING) {
        // 如果正在连接中，使用 terminate 强制终止
        console.log('[ACP] WebSocket still connecting, using terminate()');
        this.ws.terminate();
      }
      // CLOSED 状态无需操作
      
      this.ws = null;
    }

    // 终止子进程及其进程树
    if (this.process) {
      const pid = this.process.pid;
      console.log(`[ACP] Terminating process PID: ${pid}`);
      
      // 移除进程上的所有监听器，防止内存泄漏
      this.process.removeAllListeners();
      
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          console.log('[ACP] Process termination timeout, forcing kill...');
          this.forceKillProcess(pid);
          resolve();
        }, 3000);  // 减少超时时间，因为 forceKillProcess 现在是同步的
        
        // Windows 平台：SIGTERM 无效，直接使用 taskkill
        // Unix 平台：先尝试 SIGTERM，超时后 SIGKILL
        if (process.platform === 'win32') {
          // Windows: 直接强制终止
          this.forceKillProcess(pid);
          clearTimeout(timeout);
          resolve();
        } else {
          // Unix: 尝试优雅终止
          const killed = this.process!.kill('SIGTERM');
          
          if (!killed) {
            clearTimeout(timeout);
            this.forceKillProcess(pid);
            resolve();
          } else {
            // 等待进程退出
            const exitCheck = setInterval(() => {
              try {
                // 检查进程是否还存在
                process.kill(pid!, 0);
              } catch {
                // 进程已不存在
                clearInterval(exitCheck);
                clearTimeout(timeout);
                resolve();
              }
            }, 100);
          }
        }
      });
      
      this.process = null;
    }

    // Reject all pending requests
    for (const [id, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();

    this.sessionId = null;
    this.setState('disconnected');
    this.emit('disconnected');
  }

  private setState(state: AcpConnectionState): void {
    this.state = state;
    this.emit('stateChange', state);
  }

  /**
   * 强制终止指定 PID 的进程及其子进程
   * Windows: 使用 taskkill /F /T 同步终止进程树
   * Unix: 使用 SIGKILL
   * 
   * 关键修复：使用同步方式确保进程在应用退出前被终止
   */
  private forceKillProcess(pid: number | undefined): void {
    if (!pid) return;
    
    console.log(`[ACP] Force killing process tree PID: ${pid}`);
    
    if (process.platform === 'win32') {
      // Windows: 使用同步方式终止进程树，确保在应用退出前完成
      // /F = 强制终止, /T = 终止指定进程及其子进程
      try {
        execSync(`taskkill /pid ${pid} /F /T`, { 
          timeout: 5000,
          encoding: 'utf-8'
        });
        console.log(`[ACP] Process tree ${pid} force killed successfully`);
      } catch (error) {
        // 进程可能已经不存在，忽略错误
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (!errorMsg.includes('未找到') && !errorMsg.includes('not found')) {
          console.error('[ACP] forceKill warning:', errorMsg);
        }
      }
    } else {
      // Unix: 使用 SIGKILL
      try {
        process.kill(pid, 'SIGKILL');
        console.log(`[ACP] Process ${pid} killed with SIGKILL`);
      } catch (error) {
        // 进程可能已经不存在
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (!errorMsg.includes('ESRCH')) {
          console.error('[ACP] forceKill warning:', errorMsg);
        }
      }
    }
  }

  // ========================================================================
  // Process Management
  // ========================================================================

  /**
   * 解析 iflow 可执行文件的完整路径
   * Windows: 使用 npm 全局路径 + iflow.cmd
   * Unix: 使用 which 命令
   */
  private resolveIflowPath(): string {
    try {
      if (process.platform === 'win32') {
        // Windows: 直接从环境变量构建路径，避免编码问题
        const appData = process.env.APPDATA;
        if (appData) {
          const iflowCmdPath = `${appData}\\npm\\iflow.cmd`;
          // 检查文件是否存在
          if (fs.existsSync(iflowCmdPath)) {
            console.log(`[ACP] Resolved iflow.cmd path: ${iflowCmdPath}`);
            return iflowCmdPath;
          }
        }
        
        // 降级：尝试使用 where 命令
        try {
          const result = execSync('where iflow.cmd', { encoding: 'buffer', timeout: 5000 });
          const pathStr = result.toString('utf8').trim().split('\n')[0];
          if (pathStr) {
            console.log(`[ACP] Resolved iflow path via where: ${pathStr}`);
            return pathStr;
          }
        } catch {
          // 忽略错误
        }
      } else {
        // Unix: 使用 which 命令
        const result = execSync('which iflow', { encoding: 'utf-8', timeout: 5000 });
        const path = result.trim();
        if (path) {
          console.log(`[ACP] Resolved iflow path: ${path}`);
          return path;
        }
      }
    } catch (error) {
      console.warn('[ACP] Failed to resolve iflow path, falling back to "iflow":', 
        error instanceof Error ? error.message : String(error));
    }
    
    // 最终降级：使用命令名（需要 shell: true）
    return process.platform === 'win32' ? 'iflow.cmd' : 'iflow';
  }

  private async spawnProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['--experimental-acp', `--port`, `${this.options.port}`];
      const iflowPath = this.resolveIflowPath();
      
      console.log(`[ACP] Starting iflow process: ${iflowPath} ${args.join(' ')}`);
      // 检查是否已经有进程在运行，避免重复启动
      if (this.process && !this.process.killed) {
        console.log('[ACP] Process already running, skipping spawn');
        resolve();
        return;
      }

      // Windows .cmd 文件需要 shell: true 才能执行
      // 关键修复：在 disconnect() 中移除了 /T 参数，避免误杀其他进程
      const needsShell = process.platform === 'win32' && iflowPath.endsWith('.cmd');
      
      this.process = spawn(iflowPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: needsShell,
        windowsHide: true,
      });

      if (!this.process.stdout || !this.process.stderr) {
        reject(new Error('Failed to create process streams'));
        return;
      }

      // Log stdout output
      this.process.stdout.on('data', (data) => {
        const stdout = data.toString().trim();
        if (stdout) {
          console.log('[ACP stdout]:', stdout);
          // 检测服务器启动成功的标志
          if (stdout.includes('running at ws://')) {
            console.log('[ACP] Server startup detected');
          }
        }
      });

      // Log stderr output
      this.process.stderr.on('data', (data) => {
        const stderr = data.toString().trim();
        if (stderr) {
          console.error('[ACP stderr]:', stderr);
          this.emit('stderr', stderr);
        }
      });

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        console.log(`[ACP] Process exited with code ${code}, signal ${signal}`);
        this.emit('exit', code, signal);
        this.process = null;
        if (this.state !== 'disconnected') {
          this.disconnect();
        }
      });

      this.process.on('error', (error) => {
        console.error('[ACP] Process error:', error);
        reject(new Error(`Failed to spawn process: ${error.message}`));
      });

      // Wait for the process to start, give server enough time to fully start
      console.log('[ACP] Waiting for server to start (10s)...');
      
      // 使用 try-finally 确保定时器被正确清理
      let checkInterval: NodeJS.Timeout | null = null;
      let startupTimeout: NodeJS.Timeout | null = null;
      let settled = false;
      
      const cleanupTimers = () => {
        if (checkInterval) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
        if (startupTimeout) {
          clearTimeout(startupTimeout);
          startupTimeout = null;
        }
      };
      
      // 检查进程是否仍在运行
      checkInterval = setInterval(() => {
        if (this.process?.killed && !settled) {
          cleanupTimers();
          reject(new Error('iflow process exited prematurely'));
        }
      }, 500);
      
      startupTimeout = setTimeout(() => {
        if (!settled) {
          cleanupTimers();
          console.log('[ACP] Server should be ready now');
          resolve();
        }
      }, 10000);
    });
  }

  // ========================================================================
  // WebSocket Connection
  // ========================================================================

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 强制使用 IPv4 地址，避免 IPv6 解析问题
      const url = `ws://127.0.0.1:${this.options.port}/acp?peer=iflow`;
      
      console.log(`[ACP] Attempting to connect to: ${url}`);
      this.ws = new WebSocket(url);
      
      console.log(`[ACP] WebSocket created, readyState: ${this.ws.readyState}`);
      console.log(`[ACP] CONNECTING=${WebSocket.CONNECTING}, OPEN=${WebSocket.OPEN}`);

      this.ws.on('open', () => {
        console.log('[ACP] WebSocket connected successfully');
        resolve();
      });

      this.ws.on('message', (data: Buffer) => {
        const messageText = data.toString().trim();
        
        // Handle special ACP protocol messages (starting with //)
        if (messageText.startsWith('//')) {
          this.handleSpecialMessage(messageText);
          return;
        }
        
        // Handle JSON-RPC messages
        try {
          const message = JSON.parse(messageText) as JsonRpcResponse | JsonRpcNotification;
          this.handleMessage(message);
        } catch (error) {
          console.error('[ACP] Failed to parse WebSocket message:', error.message);
        }
      });

      this.ws.on('error', (error) => {
        // 捕获 WebSocket 错误，避免未处理的异常
        console.error('[ACP] WebSocket error:', error instanceof Error ? error.message : String(error));
        if (this.state === 'connecting') {
          reject(new Error(`WebSocket error: ${error instanceof Error ? error.message : String(error)}`));
        }
      });

      this.ws.on('close', (code, reason) => {
        console.log(`[ACP] WebSocket closed: ${code} - ${reason}`);
        if (this.state !== 'disconnected') {
          this.disconnect();
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 15000); // 增加超时时间到 15 秒
    });
  }

  // ========================================================================
  // Protocol Handlers
  // ========================================================================

  private handleMessage(message: JsonRpcResponse | JsonRpcNotification): void {
    // Check if it's a response (has 'id' field)
    if ('id' in message) {
      this.handleResponse(message as JsonRpcResponse);
    } else {
      // It's a notification
      this.handleNotification(message as JsonRpcNotification);
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    console.log('[ACP] Received response for request:', response.id, 
      response.error ? `Error: ${response.error.code} - ${response.error.message}` : 'Success');
    
    const pending = this.pendingRequests.get(String(response.id));
    if (!pending) {
      console.warn('[ACP] Received response for unknown request:', response.id);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(String(response.id));

    if (response.error) {
      const error = new Error(
        `[ACP Error ${response.error.code}] ${response.error.message}`
      );
      console.error('[ACP] Request failed:', response.id, response.error);
      pending.reject(error);
    } else {
      console.log('[ACP] Request succeeded:', response.id);
      pending.resolve(response.result);
    }
  }

  private handleNotification(notification: JsonRpcNotification): void {
    console.log('[ACP] Received notification:', JSON.stringify(notification, null, 2));
    
    // Handle session/update notifications (AionUi format)
    if (notification.method === 'session/update') {
      const updateParams = notification.params as { sessionId: string; update: any };
      console.log('[ACP] session/update params:', JSON.stringify(updateParams, null, 2));
      if (updateParams && updateParams.update && updateParams.sessionId) {
        console.log('[ACP] Emitting update event:', { sessionId: updateParams.sessionId, updateType: updateParams.update.sessionUpdate });
        this.emit('update', {
          sessionId: updateParams.sessionId,
          update: updateParams.update
        });
      } else {
        console.warn('[ACP] session/update missing required fields:', updateParams);
      }
    } else {
      this.emit('notification', notification);
    }
  }

  private handleSpecialMessage(messageText: string): void {
    // Handle //ready - server ready notification
    if (messageText === '//ready') {
      console.log('[ACP] Server ready');
      this.emit('ready');
      return;
    }
    
    // Handle //stderr - server error output
    if (messageText.startsWith('//stderr ')) {
      const stderrContent = messageText.substring(9); // Remove '//stderr '
      console.error('[ACP stderr]', stderrContent);
      this.emit('stderr', stderrContent);
      return;
    }
    
    // Handle other special messages
    console.log('[ACP] Special message:', messageText);
  }

  private sendRequest<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      // 检查 WebSocket 连接状态
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = generateRequestId();
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      console.log(`[ACP] Sending request:`, { id, method, params });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      try {
        this.ws.send(JSON.stringify(request), (error) => {
          if (error) {
            clearTimeout(timeout);
            this.pendingRequests.delete(id);
            reject(new Error(`Failed to send request: ${error.message}`));
          }
        });
      } catch (error) {
        // 捕获 EPIPE 等错误，避免未处理的异常
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(new Error(`WebSocket send error: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  }

  // ========================================================================
  // ACP Methods
  // ========================================================================

  async initialize(): Promise<AcpInitializeResult> {
    this.setState('initializing');

    // Use iflow cli expected format (protocolVersion as number, clientCapabilities)
    const params = {
      protocolVersion: 1,
      clientInfo: {
        name: 'iflow-paw',
        version: '1.0.0',
      },
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true }
      },
    };

    const result = await this.sendRequest(
      ACP_METHODS.INITIALIZE,
      params
    ) as AcpInitializeResult;

    console.log('[ACP] Initialized:', result.serverInfo || result);
    return result;
  }

  async newSession(params: AcpNewSessionParams): Promise<AcpNewSessionResult> {
    // iflow cli uses session/load with sessionId and cwd parameters
    // Generate a session ID if not provided
    const sessionId = params.sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // cwd is required by iflow cli
    const requestParams: { sessionId: string; cwd: string } = {
      sessionId,
      cwd: params.workingDir || process.cwd()
    };
    
    const result = await this.sendRequest(
      ACP_METHODS.SESSION_LOAD,
      requestParams
    ) as AcpNewSessionResult;

    this.sessionId = result.sessionId || sessionId;
    console.log('[ACP] Session loaded/created:', this.sessionId);
    return result;
  }

  async prompt(params: AcpPromptParams): Promise<AcpPromptResult> {
    return await this.sendRequest(
      ACP_METHODS.SESSION_PROMPT,
      params
    ) as AcpPromptResult;
  }

  async setMode(params: AcpSetModeParams): Promise<AcpSetModeResult> {
    return await this.sendRequest(
      ACP_METHODS.SESSION_SET_MODE,
      params
    ) as AcpSetModeResult;
  }

  async setModel(params: AcpSetModelParams): Promise<AcpSetModelResult> {
    return await this.sendRequest(
      ACP_METHODS.SESSION_SET_MODEL,
      params
    ) as AcpSetModelResult;
  }

  async setDeepThinking(params: AcpSetDeepThinkingParams): Promise<AcpSetDeepThinkingResult> {
    return await this.sendRequest(
      ACP_METHODS.SESSION_SET_DEEP_THINKING,
      params
    ) as AcpSetDeepThinkingResult;
  }

  // ========================================================================
  // Getters
  // ========================================================================

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  get currentState(): AcpConnectionState {
    return this.state;
  }

  get currentSessionId(): string | null {
    return this.sessionId;
  }
}