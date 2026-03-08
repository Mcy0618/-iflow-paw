/**
 * ACP Connection Manager
 * Handles JSON-RPC 2.0 communication with iFlow CLI via WebSocket
 */

import { spawn, ChildProcess, execSync } from 'child_process';
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
  private options: { port: number; host: string };
  
  // 会话设置状态
  private _currentMode: SupportedMode = 'Smart';
  private _currentModel: SupportedModel = 'GLM-4.7';
  private _deepThinkingEnabled: boolean = false;
  private _deepThinkingLevel: number = 1;

  constructor(options: AcpConnectionOptions = {}) {
    super();
    this.options = {
      port: options.port ?? 8090,
      host: options.host ?? 'localhost',
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

  /**
   * 检测 WebSocket 服务是否真正就绪
   * 通过尝试建立实际的 WebSocket 连接来验证服务是否可用
   */
  private async waitForWebSocketReady(port: number, maxWaitMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 500;

    console.log(`[ACP] Waiting for WebSocket to be ready on port ${port} (maxWait: ${maxWaitMs}ms)...`);

    while (Date.now() - startTime < maxWaitMs) {
      const elapsed = Date.now() - startTime;
      // 每5秒输出一次等待进度
      if (elapsed % 5000 < checkInterval) {
        console.log(`[ACP] Still waiting for WebSocket... (${elapsed}ms / ${maxWaitMs}ms)`);
      }

      try {
        // 尝试建立实际的 WebSocket 连接
        const testWs = new WebSocket(`ws://127.0.0.1:${port}/acp?peer=test`);

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            testWs.terminate();
            reject(new Error('Test connection timeout'));
          }, 2000);

          testWs.on('open', () => {
            clearTimeout(timeout);
            testWs.close();
            resolve();
          });

          testWs.on('error', () => {
            clearTimeout(timeout);
            reject(new Error('Test connection failed'));
          });
        });

        console.log(`[ACP] WebSocket is ready after ${Date.now() - startTime}ms`);
        return true;
      } catch {
        // WebSocket 未就绪，继续等待
        await new Promise(r => setTimeout(r, checkInterval));
      }
    }

    console.error(`[ACP] WebSocket failed to become ready within ${maxWaitMs}ms`);
    return false;
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
      
      // 等待 //ready 消息 - 关键修复：必须收到 ready 消息才能继续
      await new Promise<void>((resolve, reject) => {
        const handler = (message: string) => {
          if (message === 'ready') {
            console.log('[ACP] Received ready message from server');
            this.off('ready', handler);
            resolve();
          }
        };
        this.on('ready', handler);
        
        // 超时保护 - 必须收到 ready 才能继续，否则 reject
        const timeout = setTimeout(() => {
          this.off('ready', handler);
          reject(new Error('Server ready message timeout - server may not be fully initialized'));
        }, 10000); // 增加超时时间到 10 秒
        
        // 清理函数
        const cleanup = () => clearTimeout(timeout);
        this.once('error', cleanup);
        this.once('disconnected', cleanup);
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
    for (const [_id, request] of this.pendingRequests) {
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
   * 关键修复：使用 encoding: 'buffer' 避免中文乱码问题
   */
  private forceKillProcess(pid: number | undefined): void {
    if (!pid) return;
    
    console.log(`[ACP] Force killing process tree PID: ${pid}`);
    
    if (process.platform === 'win32') {
      // Windows: 使用同步方式终止进程树，确保在应用退出前完成
      // /F = 强制终止, /T = 终止指定进程及其子进程
      // 关键修复：使用 encoding: 'buffer' 避免中文编码问题
      try {
        const output = execSync(`taskkill /pid ${pid} /F /T`, { 
          timeout: 5000,
          encoding: 'buffer',
          windowsHide: true
        });
        console.log(`[ACP] Process tree ${pid} force killed successfully:`, output.toString('utf8').trim());
      } catch (error: any) {
        // 进程可能已经不存在，忽略这些常见错误
        // 关键修复：处理 buffer 输出的错误信息
        let errorMsg: string;
        if (error?.stderr) {
          errorMsg = error.stderr.toString('utf8');
        } else if (error?.message) {
          errorMsg = error.message;
        } else {
          errorMsg = String(error);
        }
        
        const ignorablePatterns = [
          '未找到', '没有找到',           // 中文：进程未找到
          'not found', 'no such process', // 英文：进程不存在
          'ESRCH',                         // 系统错误码：进程不存在
          '进程不在',                       // 中文变体
          'has already been',              // 进程已被终止
          '已经终止',                       // 中文变体
        ];
        const shouldIgnore = ignorablePatterns.some(pattern => 
          errorMsg.toLowerCase().includes(pattern.toLowerCase())
        );
        if (!shouldIgnore) {
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

      // Wait for the process to start, with dynamic port detection
      // Increased from 25s to 30s to provide more buffer time
      console.log('[ACP] Waiting for server to start...');
      
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
      
      // 检查进程是否仍在运行 + WebSocket 是否就绪
      checkInterval = setInterval(async () => {
        if (this.process?.killed && !settled) {
          cleanupTimers();
          reject(new Error('iflow process exited prematurely'));
          return;
        }
        
        // 首先检测 TCP 端口是否可连接
        const portReady = await this.checkPortInUse(this.options.port);
        if (portReady && !settled) {
          console.log('[ACP] TCP port is ready, checking WebSocket...');
          
          // 关键修复：等待 WebSocket 真正就绪（超时增加到20秒）
          const wsReady = await this.waitForWebSocketReady(this.options.port, 20000);
          if (wsReady && !settled) {
            cleanupTimers();
            settled = true;
            console.log('[ACP] WebSocket is ready, server startup complete');
            resolve();
          }
          // 如果 WebSocket 未就绪，继续等待下一次检查
        }
      }, 1000);
      
      // 30秒总超时
      startupTimeout = setTimeout(() => {
        if (!settled) {
          cleanupTimers();
          settled = true;
          console.error('[ACP] Server startup timeout after 30000ms');
          
          // 超时后强制终止进程
          if (this.process && !this.process.killed) {
            console.log('[ACP] Force killing process due to startup timeout');
            const pid = this.process.pid;
            this.forceKillProcess(pid);
          }
          
          reject(new Error('Server startup timeout - process did not become ready within 30 seconds'));
        }
      }, 30000);
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
      const connectStartTime = Date.now();
      this.ws = new WebSocket(url);

      console.log(`[ACP] WebSocket created, readyState: ${this.ws.readyState}`);
      console.log(`[ACP] CONNECTING=${WebSocket.CONNECTING}, OPEN=${WebSocket.OPEN}`);

      this.ws.on('open', () => {
        const connectTime = Date.now() - connectStartTime;
        console.log(`[ACP] WebSocket connected successfully in ${connectTime}ms`);
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
          console.error('[ACP] Failed to parse WebSocket message:', error instanceof Error ? error.message : String(error));
        }
      });

      this.ws.on('error', (error: Error) => {
        // 捕获 WebSocket 错误，避免未处理的异常
        console.error('[ACP] WebSocket error:', error instanceof Error ? error.message : String(error));
        if (this.state === 'connecting') {
          reject(new Error(`WebSocket error: ${error instanceof Error ? error.message : String(error)}`));
        }
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        console.log(`[ACP] WebSocket closed: ${code} - ${reason}`);
        if (this.state !== 'disconnected') {
          this.disconnect();
        }
      });

      // Timeout after 30 seconds (增加超时时间到30秒)
      setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket connection timeout (30s)'));
        }
      }, 30000);
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
    const pending = this.pendingRequests.get(String(response.id));

    if (!pending) {
      console.warn('[ACP] Received response for unknown/expired request:', response.id);
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
    return this.sendRequestWithTimeout(method, params, 60000); // 默认超时增加到60秒
  }

  private sendRequestWithTimeout<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs: number = 60000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // 检查 WebSocket 连接状态
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        console.error(`[ACP] Cannot send request ${method}: WebSocket not connected (state: ${this.ws?.readyState})`);
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

      const requestStartTime = Date.now();
      console.log(`[ACP] Sending request:`, { id, method, timeout: timeoutMs });

      const timeout = setTimeout(() => {
        const elapsed = Date.now() - requestStartTime;
        this.pendingRequests.delete(id);
        console.error(`[ACP] Request timeout after ${elapsed}ms: ${method} (timeout: ${timeoutMs}ms)`);
        reject(new Error(`Request timeout: ${method} (elapsed: ${elapsed}ms, timeout: ${timeoutMs}ms)`));
      }, timeoutMs);

      this.pendingRequests.set(id, { 
        resolve: resolve as (value: unknown) => void, 
        reject, 
        timeout 
      });

      try {
        this.ws.send(JSON.stringify(request), (error?: Error) => {
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

  private initializeResult: AcpInitializeResult | null = null;

  async initialize(): Promise<AcpInitializeResult> {
    // 防止重复初始化
    if (this.state === 'connected' && this.initializeResult) {
      console.log('[ACP] Already initialized, returning cached result');
      return this.initializeResult;
    }
    
    // 如果正在初始化中，等待完成
    if (this.state === 'initializing') {
      console.log('[ACP] Initialization already in progress, waiting...');
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this.state === 'connected' && this.initializeResult) {
            clearInterval(checkInterval);
            resolve(this.initializeResult);
          } else if (this.state === 'error') {
            clearInterval(checkInterval);
            reject(new Error('Initialization failed'));
          }
        }, 100);
        
        // 60秒超时
        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('Initialization wait timeout'));
        }, 60000);
      });
    }

    this.setState('initializing');

    try {
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

      // 增加超时时间到 60 秒
      const result = await this.sendRequestWithTimeout(
        ACP_METHODS.INITIALIZE,
        params,
        60000
      ) as AcpInitializeResult;

      // 关键修复：初始化成功后更新状态
      this.initializeResult = result;
      this.setState('connected');
      console.log('[ACP] Initialized successfully:', result.serverInfo || result);
      return result;
    } catch (error) {
      this.setState('error');
      throw error;
    }
  }

  async newSession(params: AcpNewSessionParams): Promise<AcpNewSessionResult> {
    // iflow cli uses session/load with sessionId and cwd parameters
    // Generate a session ID if not provided
    const sessionId = params.sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 构建 session/load 请求参数
    // 尝试传递 model 和 deepThinking 参数（如果服务器支持）
    const requestParams: { sessionId: string; cwd: string; model?: string; deepThinking?: boolean; deepThinkingLevel?: number } = {
      sessionId,
      cwd: params.workingDir || process.cwd()
    };
    
    // 尝试传递模型参数（如果服务器支持）
    if (params.options && params.options.model) {
      requestParams.model = params.options.model;
      console.log('[ACP] Including model in session/load:', params.options.model);
    }
    
    // 尝试传递深度思考参数（如果服务器支持）
    if (params.options && params.options.deepThinking !== undefined) {
      requestParams.deepThinking = params.options.deepThinking;
      if (params.options.deepThinkingLevel !== undefined) {
        requestParams.deepThinkingLevel = params.options.deepThinkingLevel;
      }
      console.log('[ACP] Including deepThinking in session/load:', params.options.deepThinking);
    }
    
    const result = await this.sendRequest(
      ACP_METHODS.SESSION_LOAD,
      requestParams
    ) as AcpNewSessionResult;

    this.sessionId = result.sessionId || sessionId;
    console.log('[ACP] Session loaded/created:', this.sessionId);
    
    // 更新本地设置
    if (params.options) {
      const options = params.options;
      
      // 更新本地模型状态
      if (options.model) {
        this._currentModel = options.model as SupportedModel;
        console.log('[ACP] Local model updated:', options.model);
      }
      
      // 更新本地深度思考状态
      if (options.deepThinking !== undefined) {
        this._deepThinkingEnabled = options.deepThinking;
        if (options.deepThinkingLevel !== undefined) {
          this._deepThinkingLevel = options.deepThinkingLevel;
        }
        console.log('[ACP] Local deepThinking updated:', options.deepThinking);
      }
      
      // 设置模式（支持服务器同步）
      if (options.mode) {
        console.log('[ACP] Setting mode:', options.mode);
        await this.setMode({ mode: options.mode });
      }
    }
    
    return result;
  }

  async prompt(params: AcpPromptParams): Promise<AcpPromptResult> {
    return await this.sendRequest(
      ACP_METHODS.SESSION_PROMPT,
      params as unknown as Record<string, unknown>
    ) as AcpPromptResult;
  }

  async setMode(params: AcpSetModeParams): Promise<AcpSetModeResult> {
    // 更新本地状态
    const previousMode = this._currentMode;
    this._currentMode = params.mode as SupportedMode;
    
    // 如果没有活跃 session，只更新本地状态，不发送请求
    if (!this.sessionId) {
      console.log('[ACP] No active session, updating local mode only:', params.mode);
      return { success: true, previousMode, currentMode: this._currentMode };
    }
    
    // 将模式名称转换为小写，匹配 iflow CLI 服务器期望的格式
    // 服务器接受: yolo, smart, plan, default
    const modeMap: Record<string, string> = {
      'YOLO': 'yolo',
      'Plan': 'plan',
      'Smart': 'smart',
      'Ask': 'default',
    };
    const serverModeId = modeMap[params.mode] || params.mode.toLowerCase();
    
    const requestParams = {
      sessionId: this.sessionId,
      modeId: serverModeId,
    };
    const result = await this.sendRequest(
      ACP_METHODS.SESSION_SET_MODE,
      requestParams
    ) as AcpSetModeResult;
    return result;
  }

  async setModel(params: AcpSetModelParams): Promise<AcpSetModelResult> {
    // 更新本地状态
    const previousModel = this._currentModel;
    this._currentModel = params.model as SupportedModel;
    let serverSynced = false;

    // 如果会话已创建，尝试发送 session/set_config_option 请求到服务器
    // 这样可以让服务器端的模型设置立即生效
    if (this.sessionId) {
      try {
        const requestParams = {
          sessionId: this.sessionId,
          options: {
            model: params.model,
          },
        };
        await this.sendRequest(ACP_METHODS.SESSION_SET_CONFIG_OPTION, requestParams);
        serverSynced = true;
        console.log('[ACP] Model updated on server:', params.model);
      } catch (error) {
        // 服务器调用失败不影响本地状态，保持向后兼容
        // 模型设置会在下次 prompt 时通过会话配置生效
        console.error(
          `[ACP] Model updated locally (server call failed): ${params.model}`,
          error instanceof Error ? error.message : String(error)
        );
      }
    } else {
      // 会话未创建，只更新本地状态
      console.log('[ACP] Model updated locally (no session):', params.model);
    }

    return { success: true, previousModel, currentModel: this._currentModel, serverSynced };
  }

  async setDeepThinking(params: AcpSetDeepThinkingParams): Promise<AcpSetDeepThinkingResult> {
    // 更新本地状态
    this._deepThinkingEnabled = params.enabled;
    if (params.level !== undefined) {
      this._deepThinkingLevel = params.level;
    }

    // 如果会话已创建，尝试发送 session/set_config_option 请求到服务器
    // 这样可以让服务器端的深度思考设置立即生效
    let serverSynced = false;
    if (this.sessionId) {
      try {
        const requestParams = {
          sessionId: this.sessionId,
          options: {
            deepThinking: params.enabled,
            ...(params.level !== undefined && { deepThinkingLevel: params.level }),
          },
        };
        await this.sendRequest(ACP_METHODS.SESSION_SET_CONFIG_OPTION, requestParams);
        console.log('[ACP] DeepThinking updated on server:', params.enabled, 'level:', this._deepThinkingLevel);
        serverSynced = true;
      } catch (error) {
        // 服务器调用失败不影响本地状态，保持向后兼容
        // 深度思考设置会在下次 prompt 时通过会话配置生效
        console.log('[ACP] DeepThinking updated locally (server call failed):', params.enabled);
      }
    } else {
      // 会话未创建，只更新本地状态
      console.log('[ACP] DeepThinking updated locally (no session):', params.enabled);
    }

    return {
      success: true,
      enabled: params.enabled,
      level: this._deepThinkingLevel,
      serverSynced,
    };
  }

  // ========================================================================
  // IConnection Interface Methods
  // ========================================================================

  /**
   * 发送 Prompt 请求 (IConnection 接口)
   */
  async sendPrompt(params: AcpPromptParams): Promise<AcpPromptResult> {
    return this.prompt(params);
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

  // 会话设置 getters
  getCurrentMode(): SupportedMode {
    return this._currentMode;
  }

  getCurrentModel(): SupportedModel {
    return this._currentModel;
  }

  isDeepThinkingEnabled(): boolean {
    return this._deepThinkingEnabled;
  }

  getDeepThinkingLevel(): number {
    return this._deepThinkingLevel;
  }
}