/**
 * SDK Client - 使用 @iflow-ai/iflow-cli-sdk 实现 IConnection 接口
 * 
 * 提供基于官方 SDK 的连接实现，支持：
 * - 自动进程管理
 * - 配置同步
 * - 流式响应（通过异步迭代器）
 */

import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import { IConnection, ConnectionOptions } from './interface';
import {
  AcpConnectionState,
  SupportedMode,
  SupportedModel,
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
} from './types';

const execAsync = promisify(exec);

// ============================================================================
// SDK Types (动态导入)
// ============================================================================

/**
 * SDK 客户端类型定义
 * 基于官方文档：https://platform.iflow.cn/cli/sdk/sdk-typescript
 */

// 消息类型枚举
enum MessageType {
  ASSISTANT = 'assistant',
  TOOL_CALL = 'tool_call',
  PLAN = 'plan',
  TASK_FINISH = 'task_finish',
  USER = 'user',
  ERROR = 'error',
}

// AgentInfo 类型
interface AgentInfo {
  agentId: string;
  agentIndex?: number;
  taskId?: string;
  timestamp?: number;
}

// ============================================================================
// SDK Error Types
// ============================================================================

/**
 * 连接错误
 */
class ConnectionError extends Error {
  cause?: Error;
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'ConnectionError';
    this.cause = cause;
    Object.setPrototypeOf(this, ConnectionError.prototype);
  }
}

/**
 * 超时错误
 */
class TimeoutError extends Error {
  cause?: Error;
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'TimeoutError';
    this.cause = cause;
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

// 消息类型定义
interface AssistantMessage {
  type: MessageType.ASSISTANT;
  chunk: { text: string };
  agentInfo?: AgentInfo;
}

interface ToolCallMessage {
  type: MessageType.TOOL_CALL;
  status: string;
  toolName?: string;
  toolCallId?: string;
  label?: string;
  rawInput?: unknown;
  agentInfo?: AgentInfo;
}

interface PlanMessage {
  type: MessageType.PLAN;
  entries: Array<{
    content: string;
    priority: string;
    status: 'completed' | 'pending';
  }>;
}

interface TaskFinishMessage {
  type: MessageType.TASK_FINISH;
  stopReason: 'end_turn' | 'max_tokens' | 'interrupted';
}

interface ErrorMessage {
  type: MessageType.ERROR;
  code?: string;
  message: string;
}

type SDKMessage = AssistantMessage | ToolCallMessage | PlanMessage | TaskFinishMessage | ErrorMessage;

// ============================================================================
// SDK Configuration Types (基于官方文档)
// ============================================================================

/**
 * 认证方法信息
 */
interface AuthMethodInfo {
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
}

/**
 * MCP 服务器配置
 */
interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * Hook 配置
 */
interface HookConfigs {
  beforeAgentExecute?: (input: any) => any;
  afterAgentExecute?: (output: any) => any;
  onToolCall?: (toolCall: any) => void;
}

/**
 * 命令配置
 */
interface CommandConfig {
  name: string;
  description?: string;
  handler: (args: any) => Promise<any>;
}

/**
 * 子智能体配置
 */
interface SubAgentConfig {
  name: string;
  description?: string;
  model?: string;
  systemPrompt?: string;
}

/**
 * 会话设置
 */
interface SessionSettings {
  maxHistoryLength?: number;
  timeout?: number;
  enableStreaming?: boolean;
}

// SDK 配置选项（基于官方文档）
interface IFlowOptions {
  url?: string;
  cwd?: string;
  timeout?: number;
  logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  processStartPort?: number;
  autoStartProcess?: boolean;
  authMethodId?: string;
  authMethodInfo?: AuthMethodInfo;
  mcpServers?: MCPServerConfig[];
  hooks?: HookConfigs;
  commands?: CommandConfig[];
  agents?: SubAgentConfig[];
  sessionSettings?: SessionSettings;
  permissionMode?: 'auto' | 'manual' | 'selective';
  autoApproveTypes?: string[];
  fileAccess?: boolean;
  fileMaxSize?: number;
  fileReadOnly?: boolean;
  fileAllowedDirs?: string[];
}

// SDK 客户端实例接口
interface IFlowClientInstance {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(content: string | Array<{ type: string; text?: string }>): Promise<void>;
  receiveMessages(): AsyncIterable<SDKMessage>;
  interrupt(): Promise<void>;
  newSession(params?: { cwd?: string }): Promise<{ sessionId?: string }>;
  loadSession(sessionId: string): Promise<{ sessionId?: string }>;
  readonly isConnected: boolean;
  getSessionId(): string | null;
  config: {
    get<T = any>(key: string): T | undefined;
    set<T = any>(key: string, value: T): void;
  };
}

// SDK 模块接口
interface IflowCliSDK {
  IFlowClient: new (options?: IFlowOptions) => IFlowClientInstance;
  MessageType: typeof MessageType;
}

// ============================================================================
// SDK Client Implementation
// ============================================================================

export class SdkClient extends EventEmitter implements IConnection {
  private sdk: IFlowClientInstance | null = null;
  private sdkModule: IflowCliSDK | null = null;
  private state: AcpConnectionState = 'disconnected';
  private options: ConnectionOptions['sdk'];
  private messageLoopRunning: boolean = false;
  private messageLoopAbortController: AbortController | null = null;
  
  // 本地状态缓存
  private _currentMode: SupportedMode = 'Smart';
  private _currentModel: SupportedModel = 'GLM-4.7';
  private _deepThinkingEnabled: boolean = false;
  private _deepThinkingLevel: number = 1;
  private _sessionId: string | null = null;
  private _lastWorkingDir: string | null = null;

  constructor(options: ConnectionOptions['sdk'] = {}) {
    super();
    this.options = {
      autoStart: true,
      ...options,
    };
  }

  // ========================================================================
  // 进程清理功能
  // ========================================================================

  /**
   * 终止占用指定端口的进程
   * 支持 Windows 和 Unix 系统
   */
  private async killProcessOnPort(port: number): Promise<boolean> {
    const platform = process.platform;
    console.log(`[SdkClient] Attempting to kill process on port ${port} (${platform})`);

    try {
      if (platform === 'win32') {
        // Windows: 使用 netstat 找到 PID，然后 taskkill
        const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
        const lines = stdout.trim().split('\n').filter(Boolean);
        
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          
          if (pid && /^\d+$/.test(pid) && pid !== '0') {
            console.log(`[SdkClient] Killing process PID ${pid} on port ${port}`);
            try {
              await execAsync(`taskkill /F /PID ${pid}`);
              console.log(`[SdkClient] Process ${pid} terminated`);
            } catch {
              console.log(`[SdkClient] Failed to kill process ${pid}, may have already exited`);
            }
          }
        }
      } else {
        // Unix: 使用 lsof 或 fuser
        try {
          await execAsync(`fuser -k ${port}/tcp`);
          console.log(`[SdkClient] Killed process on port ${port}`);
        } catch {
          // 尝试 lsof
          const { stdout } = await execAsync(`lsof -t -i:${port}`);
          const pids = stdout.trim().split('\n').filter(Boolean);
          for (const pid of pids) {
            await execAsync(`kill -9 ${pid}`);
          }
        }
      }
      
      // 等待端口释放
      await new Promise(resolve => setTimeout(resolve, 1000));
      return true;
    } catch (error) {
      console.log(`[SdkClient] No process found on port ${port} or cleanup failed`);
      return false;
    }
  }

  /**
   * 检测端口是否有服务在监听（仅检测 LISTENING 状态）
   * 修复：避免 TIME_WAIT 等状态的误报
   */
  private async isPortInUse(port: number): Promise<boolean> {
    const { execSync } = require('child_process');
    try {
      if (process.platform === 'win32') {
        // Windows: 只检测 LISTENING 状态
        const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf-8' });
        return result.trim().length > 0;
      } else {
        // Unix: 使用 lsof 检测监听状态
        const result = execSync(`lsof -i:${port} -sTCP:LISTEN`, { encoding: 'utf-8' });
        return result.trim().length > 0;
      }
    } catch {
      return false;
    }
  }

  // ========================================================================
  // SDK 动态加载
  // ========================================================================

  private async loadSDK(): Promise<IflowCliSDK> {
    if (this.sdkModule) {
      return this.sdkModule;
    }

    try {
      // 动态导入 SDK
      // @ts-ignore - 动态导入
      const module = await import('@iflow-ai/iflow-cli-sdk');
      this.sdkModule = module as unknown as IflowCliSDK;
      return this.sdkModule!;
    } catch (error) {
      throw new Error(
        `SDK not installed. Please install: npm install @iflow-ai/iflow-cli-sdk\n` +
        `Original error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ========================================================================
  // IConnection Implementation
  // ========================================================================

  async connect(): Promise<void> {
    if (this.state !== 'disconnected') {
      throw new Error(`Cannot connect: current state is ${this.state}`);
    }

    // 最多重试 3 次
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[SdkClient] Connect attempt ${attempt}/${maxRetries}`);
      
      try {
        await this._connectInternal();
        console.log(`[SdkClient] Connected successfully on attempt ${attempt}`);
        return; // 成功则直接返回
      } catch (error) {
        const rawError = error instanceof Error ? error : new Error(String(error));
        console.error(`[SdkClient] Connect attempt ${attempt} failed:`, rawError.message);
        
        // 分类错误类型
        const categorizedError = this.categorizeError(rawError);
        lastError = categorizedError;
        
        // 判断是否可重试
        const isRetryable = categorizedError instanceof ConnectionError || 
                           categorizedError instanceof TimeoutError;
        
        if (isRetryable && attempt < maxRetries) {
          console.log(`[SdkClient] Retryable ${categorizedError.name} detected, cleaning up port 8090 and retrying...`);
          console.log(`[SdkClient] Error details: ${categorizedError.message}`);
          
          // 清理端口上的残留进程
          await this.killProcessOnPort(8090);
          
          // 重置状态
          this.state = 'disconnected';
          this.sdk = null;

          // 等待端口完全释放（增加到3秒确保稳定性）
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          console.log(`[SdkClient] Non-retryable ${categorizedError.name} or max retries reached`);
          break; // 非可重试错误或已达最大重试次数
        }
      }
    }

    // 所有尝试都失败
    this.setState('error');
    this.emit('error', lastError || new Error('Connection failed'));
    throw lastError || new Error('Connection failed');
  }

  /**
   * 分类错误类型
   */
  private categorizeError(error: Error): Error {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';
    
    // 超时错误
    if (message.includes('timeout') || 
        message.includes('timed out') ||
        stack.includes('timeout')) {
      return new TimeoutError(
        `连接超时: ${error.message}`,
        error
      );
    }
    
    // 连接错误 - 连接被拒绝
    if (message.includes('econnrefused') ||
        message.includes('connection refused')) {
      return new ConnectionError(
        `连接被拒绝: iFlow CLI 端口 8090 无响应，请确保 iFlow CLI 正在运行`,
        error
      );
    }
    
    // 连接错误 - 连接超时
    if (message.includes('etimedout') ||
        message.includes('connection timed out')) {
      return new ConnectionError(
        `连接超时: 无法连接到 iFlow CLI，请检查网络或防火墙设置`,
        error
      );
    }
    
    // 连接错误 - 连接关闭
    if (message.includes('connection closed') ||
        message.includes('connection lost')) {
      return new ConnectionError(
        `连接已关闭: 与 iFlow CLI 的连接意外中断`,
        error
      );
    }
    
    // 启动错误 - iFlow 启动失败
    if (message.includes('failed to start iflow') ||
        message.includes('failed to start')) {
      return new ConnectionError(
        `启动失败: 无法启动 iFlow CLI，请检查安装是否正确`,
        error
      );
    }
    
    // 端口错误
    if (message.includes('port 8090') ||
        message.includes('port')) {
      return new ConnectionError(
        `端口错误: 端口 8090 可能被其他程序占用`,
        error
      );
    }
    
    // 工作目录错误
    if (message.includes('ENOENT') ||
        message.includes('not found') ||
        message.includes('working directory')) {
      return new ConnectionError(
        `工作目录错误: 指定的工作目录不存在或无法访问`,
        error
      );
    }
    
    // 权限错误
    if (message.includes('permission') ||
        message.includes('access denied') ||
        message.includes('eacces')) {
      return new ConnectionError(
        `权限错误: 无法访问工作目录，请检查目录权限`,
        error
      );
    }
    
    // 其他错误直接返回原错误
    return error;
  }

  /**
   * 确保有一个有效的 session
   * 添加超时保护，避免无限等待
   * @param timeoutMs 超时时间（毫秒），默认 60000ms
   */
  private async _ensureSession(timeoutMs: number = 60000): Promise<void> {
    if (this._sessionId) {
      console.log('[SdkClient] Session already exists:', this._sessionId);
      return;
    }
    
    try {
      // 确保 cwd 有有效值
      const cwd = process.cwd();
      console.log(`[SdkClient] _ensureSession: cwd = ${cwd}, timeout = ${timeoutMs}ms`);

      if (!cwd) {
        console.warn('[SdkClient] process.cwd() returned empty, using fallback');
      }

      // 添加超时保护
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Session creation timeout after ${timeoutMs}ms`)), timeoutMs);
      });

      // 使用与 public newSession 相同的参数格式
      const result = await Promise.race([
        this.sdk!.newSession({ cwd: cwd || process.env.PWD || '.' }),
        timeoutPromise
      ]);
      
      console.log('[SdkClient] _ensureSession result:', JSON.stringify(result));
      
      if (result.sessionId) {
        this._sessionId = result.sessionId;
      } else {
        // Fallback: 生成一个 session ID
        this._sessionId = `auto-${Date.now()}`;
        console.log('[SdkClient] Using generated sessionId:', this._sessionId);
      }
    } catch (error) {
      console.error('[SdkClient] _ensureSession failed:', error);
      // 生成 fallback session ID，避免后续操作失败
      this._sessionId = `fallback-${Date.now()}`;
      console.log('[SdkClient] Using fallback sessionId due to error:', this._sessionId);
      // 不抛出错误，允许后续操作继续
    }
  }

  /**
   * 内部连接实现 - 改进版：预启动优化
   * 解决 Windows 下 SDK 内置 15s 超时不够的问题
   */
  private async _connectInternal(): Promise<void> {
    this.setState('connecting');

    const SDK = await this.loadSDK();
    
    // 检查端口 8090 是否已有服务监听
    const portInUse = await this.isPortInUse(8090);
    console.log('[SdkClient] Port 8090 in use:', portInUse);
    
    // 【关键改进】如果端口未使用且需要自动启动，先预启动进程
    // 这样可以提供更长的超时时间（60s），比 SDK 内置的 15s 更可靠
    if (!portInUse && (this.options?.autoStart ?? true)) {
      console.log('[SdkClient] Pre-starting iflow process before SDK connect...');
      const preStartStartTime = Date.now();
      try {
        await this.preStartIflowProcess(8090);
        const preStartElapsed = Date.now() - preStartStartTime;
        console.log(`[SdkClient] Pre-start completed in ${preStartElapsed}ms`);

        // 等待额外时间确保 peer 完全初始化（关键：peer 初始化需要较长时间）
        // SDK 内部 session 创建超时是 10 秒，我们需要确保 peer 在 SDK 连接前完全就绪
        // 增加到 30 秒以提供更充足的初始化时间
        const waitTime = 30000;
        console.log(`[SdkClient] Waiting for peer to fully initialize (${waitTime}ms)...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        console.log('[SdkClient] Peer initialization wait completed');
      } catch (preStartError) {
        const preStartElapsed = Date.now() - preStartStartTime;
        console.warn(`[SdkClient] Pre-start failed after ${preStartElapsed}ms, will try SDK auto-start:`, preStartError);
        // 预启动失败，继续让 SDK 尝试自动启动
      }
    }
    
    // 使用官方 SDK 配置
    // 关键改进：设置 autoStartProcess: false，因为我们已经预启动了进程
    // 或者端口已被使用，连接现有服务
    const sdkOptions: IFlowOptions = {
      autoStartProcess: false,  // 改为 false，不再让 SDK 启动进程（避免 15s 超时问题）
      url: 'ws://127.0.0.1:8090/acp',  // 明确指定 URL
      logLevel: 'INFO',
      timeout: 300000, // 5分钟总超时
      cwd: this.options?.workingDir || process.cwd(), // 确保 cwd 有默认值
      processStartPort: 8090,
      fileAccess: true,
      // 设置会话相关超时配置
      sessionSettings: {
        timeout: 60000, // 会话超时 60 秒（SDK 默认 10 秒太短，已修复）
        enableStreaming: true,
      },
    };

    // 只有在 workingDir 存在时才添加 fileAllowedDirs
    if (this.options?.workingDir) {
      sdkOptions.fileAllowedDirs = [this.options.workingDir];
    }

    // 如果有自定义 URL，使用手动模式
    if (this.options?.url) {
      sdkOptions.url = this.options.url;
    }

    console.log('[SdkClient] Creating IFlowClient with options:', {
      autoStartProcess: sdkOptions.autoStartProcess,
      url: sdkOptions.url,
      timeout: sdkOptions.timeout,
      cwd: sdkOptions.cwd,
      processStartPort: sdkOptions.processStartPort,
      fileAccess: sdkOptions.fileAccess,
      fileAllowedDirs: sdkOptions.fileAllowedDirs,
      sessionSettings: sdkOptions.sessionSettings,
    });

    this.sdk = new SDK.IFlowClient(sdkOptions);

    console.log('[SdkClient] Calling connect()...');
    const connectStartTime = Date.now();
    // 连接SDK
    await this.sdk.connect();
    const connectElapsed = Date.now() - connectStartTime;
    console.log(`[SdkClient] SDK connect() completed in ${connectElapsed}ms`);
    
    console.log('[SdkClient] Connected successfully!');
    this.setState('connected');
    this.emit('connected');

    // 连接成功后手动创建默认 session（使用自定义超时包装）
    try {
      console.log('[SdkClient] Auto-creating default session after connect...');
      await this._ensureSession(60000); // 60秒超时
      console.log('[SdkClient] Default session created successfully');
    } catch (sessionError) {
      console.warn('[SdkClient] Failed to auto-create session, will retry on first message:', sessionError);
      // 不阻止连接流程，允许后续发送消息时重试
    }

    // 启动消息循环
    this.startMessageLoop();
  }

  /**
   * 预启动 iflow 进程（复用 ACP 的启动逻辑）
   * 提供更长的超时时间（60s）和更可靠的端口检测
   * 解决 Windows 下 SDK 内置 15s 超时不够的问题
   */
  private async preStartIflowProcess(port: number): Promise<void> {
    const { spawn } = require('child_process');
    const net = require('net');
    const fs = require('fs');

    // 检测端口是否就绪（通过 TCP 连接测试）
    const checkPortReady = (p: number): Promise<boolean> => {
      return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2000);
        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });
        socket.on('error', () => resolve(false));
        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
        socket.connect(p, '127.0.0.1');
      });
    };

    // 解析 iflow 路径
    const resolveIflowPath = (): string => {
      if (process.platform === 'win32') {
        const appData = process.env.APPDATA;
        if (appData) {
          const iflowCmdPath = `${appData}\\npm\\iflow.cmd`;
          if (fs.existsSync(iflowCmdPath)) {
            return iflowCmdPath;
          }
        }
        return 'iflow.cmd';
      }
      return 'iflow';
    };

    const iflowPath = resolveIflowPath();
    const args = ['--experimental-acp', '--port', `${port}`];
    
    console.log(`[SdkClient] Pre-start: Spawning: ${iflowPath} ${args.join(' ')}`);
    
    const needsShell = process.platform === 'win32' && iflowPath.endsWith('.cmd');
    
    const proc = spawn(iflowPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: needsShell,
      windowsHide: true,
      cwd: this.options?.workingDir || process.cwd(),
    });

    // 输出日志
    proc.stdout?.on('data', (data: Buffer) => {
      console.log('[SdkClient preStart stdout]:', data.toString().trim());
    });
    proc.stderr?.on('data', (data: Buffer) => {
      console.error('[SdkClient preStart stderr]:', data.toString().trim());
    });

    proc.on('error', (err: Error) => {
      console.error('[SdkClient preStart] Process error:', err);
    });

    proc.on('exit', (code: number | null) => {
      console.log('[SdkClient preStart] Process exited with code:', code);
    });

    // 等待端口就绪，最长 60 秒（比 SDK 内置的 15s 更长）
    const maxWaitMs = 60000;
    const checkIntervalMs = 500;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      if (await checkPortReady(port)) {
        console.log('[SdkClient] Port is ready after', Date.now() - startTime, 'ms');
        return;
      }
      
      // 检查进程是否意外退出
      if (proc.killed || proc.exitCode !== null) {
        throw new Error('iFlow process exited prematurely during pre-start');
      }
      
      await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    }

    // 超时后清理进程
    proc.kill();
    throw new Error(`Timeout waiting for iFlow process to start on port ${port} after ${maxWaitMs}ms`);
  }

  async disconnect(): Promise<void> {
    console.log('[SdkClient] Disconnecting...');
    
    // 停止消息循环
    this.stopMessageLoop();

    if (this.sdk) {
      try {
        await this.sdk.disconnect();
      } catch (error) {
        console.error('[SdkClient] Disconnect error:', error);
      }
      this.sdk = null;
    }

    this._sessionId = null;
    this.setState('disconnected');
    this.emit('disconnected');
    console.log('[SdkClient] Disconnected');
  }

  async initialize(): Promise<{ serverInfo: { name: string; version: string } }> {
    // SDK 模式下，connect() 已经完成了初始化
    // 返回模拟的 serverInfo
    this.setState('connected');
    return {
      serverInfo: {
        name: 'iFlow CLI SDK',
        version: '0.2.x',
      },
    };
  }

  async newSession(params: AcpNewSessionParams): Promise<AcpNewSessionResult> {
    if (!this.sdk) {
      throw new Error('SDK not connected');
    }

    // 验证 workingDir，为空时使用 process.cwd()
    const workingDir = params.workingDir || process.cwd();
    console.log('[SdkClient] newSession workingDir:', workingDir);

    console.log('[SdkClient] Creating new session with params:', params);

    try {
      // 检测 workingDir 是否变化
      const workingDirChanged = this._lastWorkingDir !== null && this._lastWorkingDir !== workingDir;
      
      // 如果已有 session 且 workingDir 未变化，复用而不是创建新的
      if (this._sessionId && !workingDirChanged) {
        console.log('[SdkClient] Reusing existing session:', this._sessionId, 'workingDir:', workingDir);
        return {
          sessionId: this._sessionId,
          modes: {
            currentModeId: this._currentMode.toLowerCase(),
            availableModes: [
              { id: 'smart', name: 'Smart', description: '智能模式' },
              { id: 'code', name: 'Code', description: '代码模式' },
            ],
          },
        };
      }

      // 如果 workingDir 变化，需要创建新 session
      if (this._sessionId && workingDirChanged) {
        console.log('[SdkClient] WorkingDir changed from', this._lastWorkingDir, 'to', workingDir, '- creating new session');
        // 清除旧 session，强制创建新 session
        this._sessionId = null;
      }
      
      // 在创建会话之前，先同步配置参数到 SDK
      // 参考 connection.ts:837-875 的实现，确保 model/mode/deepThinking 等参数正确传递
      if (params.options) {
        const options = params.options;

        try {
          // 同步模型配置
          if (options.model && this.sdk.config) {
            await this.sdk.config.set('model', options.model);
            console.log('[SdkClient] Model config synchronized:', options.model);
            this._currentModel = options.model as SupportedModel;
          }

          // 同步模式配置
          if (options.mode && this.sdk.config) {
            // 添加模式映射（与 setMode 方法保持一致）
            const modeMap: Record<string, string> = {
              'YOLO': 'yolo',
              'Plan': 'plan',
              'Smart': 'smart',
              'Ask': 'default',
            };
            const serverModeId = modeMap[options.mode] || options.mode.toLowerCase();
            await this.sdk.config.set('mode', serverModeId);
            console.log('[SdkClient] Mode config synchronized:', serverModeId);
            this._currentMode = options.mode as SupportedMode;
          }

          // 同步深度思考配置
          if (options.deepThinking !== undefined && this.sdk.config) {
            const level = options.deepThinkingLevel || 1;
            await this.sdk.config.set('deepThinking.enabled', options.deepThinking);
            await this.sdk.config.set('deepThinking.level', level);
            console.log('[SdkClient] DeepThinking config synchronized:', { enabled: options.deepThinking, level });
            this._deepThinkingEnabled = options.deepThinking;
            this._deepThinkingLevel = level;
          }
        } catch (configError) {
          // 配置同步失败不应阻止会话创建，但应记录警告
          console.warn('[SdkClient] Failed to synchronize config to SDK:', configError);
        }
      }

      // SDK 的 newSession 方法 - 如果已有 session，这会创建新的
      // 添加超时保护（60秒）
      const timeoutMs = 60000;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Session creation timeout after 60 seconds')), timeoutMs);
      });

      const result = await Promise.race([
        this.sdk.newSession({
          cwd: workingDir,
        }),
        timeoutPromise
      ]);

      // 打印 SDK 返回的完整响应
      console.log('[SdkClient] SDK newSession raw result:', JSON.stringify(result));

      // 如果 SDK 返回的 sessionId 为空，生成一个 fallback ID
      if (!result.sessionId) {
        console.warn('[SdkClient] SDK returned empty sessionId, generating fallback');
        result.sessionId = `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      this._sessionId = result.sessionId;
      this._lastWorkingDir = workingDir;
      console.log('[SdkClient] Session created:', result.sessionId, 'workingDir:', workingDir);

      // 注意：移除了 peer 初始化等待，因为：
      // 1. SDK 内部已经有超时机制
      // 2. session 创建成功就意味着 peer 已就绪
      // 3. 额外等待会增加不必要的延迟

      return {
        sessionId: result.sessionId,
        modes: {
          currentModeId: this._currentMode.toLowerCase(),
          availableModes: [
            { id: 'smart', name: 'Smart', description: '智能模式' },
            { id: 'code', name: 'Code', description: '代码模式' },
          ],
        },
      };
    } catch (error) {
      console.error('[SdkClient] newSession error:', error);
      // 如果创建新 session 失败，但已有 session，尝试复用
      if (this._sessionId) {
        console.log('[SdkClient] Falling back to existing session:', this._sessionId);
        return {
          sessionId: this._sessionId,
          modes: {
            currentModeId: this._currentMode.toLowerCase(),
            availableModes: [
              { id: 'smart', name: 'Smart', description: '智能模式' },
              { id: 'code', name: 'Code', description: '代码模式' },
            ],
          },
        };
      }
      throw error;
    }
  }

  async prompt(params: AcpPromptParams): Promise<AcpPromptResult> {
    if (!this.sdk) {
      throw new Error('SDK not connected');
    }

    console.log('[SdkClient] Sending prompt:', typeof params.prompt === 'string' ? params.prompt : 'multi-part');
    console.log('[SdkClient] Attachments:', params.attachments ? `${params.attachments.length} attachments` : 'none');

    try {
      // 从数组格式 [{ type: 'text', text: '内容' }] 提取文本
      let messageText: string;
      if (Array.isArray(params.prompt)) {
        messageText = params.prompt.map(p => p.text || '').join('');
      } else if (typeof params.prompt === 'string') {
        messageText = params.prompt;
      } else {
        messageText = String(params.prompt);
      }

      // 构建消息内容 - 支持多模态（文本 + 图片）
      let messageContent: string | Array<{ type: string; text?: string; url?: string }> = messageText;
      
      // 如果有附件，构建多部分消息
      if (params.attachments && params.attachments.length > 0) {
        const parts: Array<{ type: string; text?: string; url?: string }> = [];
        
        // 添加文本部分（如果有）
        if (messageText.trim()) {
          parts.push({ type: 'text', text: messageText });
        }
        
        // 添加图片附件
        for (const attachment of params.attachments) {
          if (attachment.type.startsWith('image/')) {
            const imageUrl = `data:${attachment.type};base64,${attachment.content}`;
            parts.push({ type: 'image', url: imageUrl });
            console.log(`[SdkClient] Added image attachment: ${attachment.name}, type: ${attachment.type}`);
          }
        }
        
        if (parts.length > 0) {
          messageContent = parts;
        }
      }

      console.log('[SdkClient] Sending message content:', typeof messageContent === 'string' 
        ? messageContent.substring(0, 50) 
        : `${(messageContent as any[]).length} parts`);
      
      await this.sdk.sendMessage(messageContent as any);
      
      return {
        messageId: `msg-${Date.now()}`,
        status: 'accepted',
      };
    } catch (error: any) {
      console.error('[SdkClient] prompt error:', error?.message || error);
      
      // 如果是连接错误，尝试重新连接并重试一次
      if (error?.message?.includes('Not connected') || 
          error?.message?.includes('Connection') ||
          error?.message?.includes('ECONNREFUSED') ||
          error?.message?.includes('socket hang up')) {
        console.log('[SdkClient] Connection lost, attempting to reconnect...');
        try {
          // 断开并重新连接
          await this.disconnect();
          await this.connect();
          
          // 验证连接状态
          if (!this.sdk || !this.sdk.isConnected) {
            throw new Error('Reconnected but SDK is not ready');
          }
          
          // 重新发送消息（包含附件）
          let messageContent: string | Array<{ type: string; text?: string; url?: string }>;
          
          if (Array.isArray(params.prompt)) {
            messageText = params.prompt.map(p => p.text || '').join('');
          } else if (typeof params.prompt === 'string') {
            messageText = params.prompt;
          } else {
            messageText = String(params.prompt);
          }
          
          // 重新构建消息内容（包含附件）
          if (params.attachments && params.attachments.length > 0) {
            const parts: Array<{ type: string; text?: string; url?: string }> = [];
            
            if (messageText.trim()) {
              parts.push({ type: 'text', text: messageText });
            }
            
            for (const attachment of params.attachments) {
              if (attachment.type.startsWith('image/')) {
                const imageUrl = `data:${attachment.type};base64,${attachment.content}`;
                parts.push({ type: 'image', url: imageUrl });
                console.log(`[SdkClient] Re-added image attachment: ${attachment.name}`);
              }
            }
            
            if (parts.length > 0) {
              messageContent = parts;
            }
          } else {
            messageContent = messageText;
          }
          
          // 发送消息
          await this.sdk.sendMessage(messageContent as any);
          console.log('[SdkClient] Prompt sent successfully after reconnect');
          
          // 重连成功，返回成功状态
          return {
            messageId: `msg-${Date.now()}`,
            status: 'accepted',
          };
          
        } catch (reconnectError) {
          console.error('[SdkClient] Reconnect failed:', reconnectError);
          // 重连失败，返回错误
          return {
            messageId: `msg-${Date.now()}`,
            status: 'error',
            error: reconnectError instanceof Error ? reconnectError.message : String(reconnectError),
          };
        }
      }
      
      // 非连接错误，直接返回错误
      return {
        messageId: `msg-${Date.now()}`,
        status: 'error',
        error: error?.message || 'Unknown error',
      };
    }
  }

  /**
   * 发送 Prompt 请求 (IConnection 接口)
   * prompt 方法的别名
   */
  async sendPrompt(params: AcpPromptParams): Promise<AcpPromptResult> {
    return this.prompt(params);
  }

  async setModel(params: AcpSetModelParams): Promise<AcpSetModelResult> {
    try {
      const previousModel = this._currentModel;

      // 调用 SDK 的 config.set() 方法同步配置
      if (this.sdk && this.sdk.config) {
        await this.sdk.config.set('model', params.model);
        console.log('[SdkClient] Model config set to SDK:', params.model);
      }

      // 更新本地状态
      this._currentModel = params.model as SupportedModel;

      return { success: true, previousModel, currentModel: params.model, serverSynced: true };
    } catch (error) {
      console.error('[SdkClient] setModel error:', error);
      // 即使 SDK 设置失败，也更新本地状态以保持一致性
      const previousModel = this._currentModel;
      this._currentModel = params.model as SupportedModel;
      return { success: true, previousModel, currentModel: params.model, serverSynced: false };
    }
  }

  async setMode(params: AcpSetModeParams): Promise<AcpSetModeResult> {
    try {
      const previousMode = this._currentMode;

      // 添加模式映射（与 connection.ts 保持一致）
      // 服务器接受: yolo, smart, plan, default
      const modeMap: Record<string, string> = {
        'YOLO': 'yolo',
        'Plan': 'plan',
        'Smart': 'smart',
        'Ask': 'default',
      };
      const serverModeId = modeMap[params.mode] || params.mode.toLowerCase();

      // 调用 SDK 的 config.set() 方法同步配置
      if (this.sdk && this.sdk.config) {
        await this.sdk.config.set('mode', serverModeId);
        console.log('[SdkClient] Mode config set to SDK:', serverModeId);
      }

      // 更新本地状态
      this._currentMode = params.mode as SupportedMode;

      return { success: true, previousMode, currentMode: params.mode };
    } catch (error) {
      console.error('[SdkClient] setMode error:', error);
      // 即使 SDK 设置失败，也更新本地状态以保持一致性
      const previousMode = this._currentMode;
      this._currentMode = params.mode as SupportedMode;
      return { success: true, previousMode, currentMode: params.mode };
    }
  }

  async setDeepThinking(params: AcpSetDeepThinkingParams): Promise<AcpSetDeepThinkingResult> {
    const level = params.level || 1;
    let serverSynced = false;

    try {
      // 调用 SDK 的 config.set() 方法同步配置
      if (this.sdk && this.sdk.config) {
        await this.sdk.config.set('deepThinking.enabled', params.enabled);
        await this.sdk.config.set('deepThinking.level', level);
        console.log('[SdkClient] DeepThinking config set to SDK:', { enabled: params.enabled, level });
        serverSynced = true;
      }

      // 更新本地状态
      this._deepThinkingEnabled = params.enabled;
      this._deepThinkingLevel = level;

      return { success: true, enabled: params.enabled, level, serverSynced };
    } catch (error) {
      console.error('[SdkClient] setDeepThinking error:', error);
      // 即使 SDK 设置失败，也更新本地状态以保持一致性
      this._deepThinkingEnabled = params.enabled;
      this._deepThinkingLevel = level;
      return { success: true, enabled: params.enabled, level, serverSynced };
    }
  }

  // ========================================================================
  // Message Loop (异步迭代器)
  // ========================================================================

  /**
   * 启动消息循环
   * 使用 SDK 的 receiveMessages() 异步迭代器
   */
  private startMessageLoop(): void {
    if (this.messageLoopRunning || !this.sdk) {
      return;
    }

    this.messageLoopRunning = true;
    this.messageLoopAbortController = new AbortController();

    console.log('[SdkClient] Starting message loop...');

    // 在后台运行消息循环
    this.runMessageLoop().catch((error) => {
      if (error.name !== 'AbortError') {
        console.error('[SdkClient] Message loop error:', error);
        this.emit('error', error);
      }
    });
  }

  private async runMessageLoop(): Promise<void> {
    if (!this.sdk) return;

    try {
      // 使用官方 SDK 的异步迭代器接收消息
      for await (const message of this.sdk.receiveMessages()) {
        // 检查是否已停止
        if (!this.messageLoopRunning) {
          break;
        }

        console.log('[SdkClient] Received message:', message.type);
        
        // 转换并发送消息
        const update = this.convertMessageToUpdate(message);
        if (update) {
          this.emit('update', {
            sessionId: this.sessionId || 'unknown',
            update: update
          });
        }

        // TASK_FINISH 表示任务完成，但不停止循环
        if (message.type === MessageType.TASK_FINISH) {
          console.log('[SdkClient] Task finished, stopReason:', (message as TaskFinishMessage).stopReason);
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[SdkClient] Message loop aborted');
      } else {
        throw error;
      }
    }
  }

  /**
   * 停止消息循环
   */
  private stopMessageLoop(): void {
    this.messageLoopRunning = false;
    if (this.messageLoopAbortController) {
      this.messageLoopAbortController.abort();
      this.messageLoopAbortController = null;
    }
    console.log('[SdkClient] Message loop stopped');
  }

  /**
   * 将 SDK 消息转换为 SessionUpdate 格式
   */
  private convertMessageToUpdate(message: SDKMessage): SessionUpdate | null {
    switch (message.type) {
      case MessageType.ASSISTANT: {
        const msg = message as AssistantMessage;
        return {
          type: 'agent_message_chunk',
          data: {
            content: msg.chunk.text,
            isComplete: false,
            agentInfo: msg.agentInfo,  // 保留 agentInfo 信息
          },
        } as SessionUpdate;
      }

      case MessageType.TOOL_CALL: {
        const msg = message as ToolCallMessage;
        return {
          type: 'tool_call',
          data: {
            toolCallId: msg.toolCallId || `tc-${Date.now()}`,
            toolName: msg.toolName || 'unknown',
            arguments: msg.rawInput || {},
            status: msg.status,
            agentInfo: msg.agentInfo,  // 保留 agentInfo 信息
          },
        } as SessionUpdate;
      }

      case MessageType.PLAN: {
        const msg = message as PlanMessage;
        return {
          type: 'plan',
          data: {
            entries: msg.entries.map(e => ({
              content: e.content,
              priority: e.priority,
              status: e.status,
            })),
          },
        } as SessionUpdate;
      }

      case MessageType.TASK_FINISH: {
        const msg = message as TaskFinishMessage;
        return {
          type: 'complete',
          data: {
            finishReason: msg.stopReason === 'end_turn' ? 'stop' : msg.stopReason,
          },
        } as SessionUpdate;
      }

      case MessageType.ERROR: {
        const msg = message as ErrorMessage;
        return {
          type: 'error',
          data: {
            code: msg.code || 'UNKNOWN',
            message: msg.message,
          },
        } as SessionUpdate;
      }

      default:
        console.log('[SdkClient] Unknown message type:', message);
        return null;
    }
  }

  // ========================================================================
  // Configuration Management
  // ========================================================================

  /**
   * 获取可用的模型列表
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      if (this.sdk && this.sdk.config) {
        const models = await this.sdk.config.get('models');
        console.log('[SdkClient] Available models:', models);
        return models || [];
      }
      // 返回默认模型列表
      return ['GLM-4.7', 'GLM-4', 'GPT-4', 'GPT-3.5'];
    } catch (error) {
      console.error('[SdkClient] getAvailableModels error:', error);
      // 返回默认模型列表
      return ['GLM-4.7', 'GLM-4', 'GPT-4', 'GPT-3.5'];
    }
  }

  /**
   * 获取可用的模式列表
   */
  async getAvailableModes(): Promise<string[]> {
    try {
      if (this.sdk && this.sdk.config) {
        const modes = await this.sdk.config.get('modes');
        console.log('[SdkClient] Available modes:', modes);
        return modes || [];
      }
      // 返回默认模式列表
      return ['Smart', 'Code'];
    } catch (error) {
      console.error('[SdkClient] getAvailableModes error:', error);
      // 返回默认模式列表
      return ['Smart', 'Code'];
    }
  }

  // ========================================================================
  // State Management
  // ========================================================================

  private setState(state: AcpConnectionState): void {
    this.state = state;
    this.emit('stateChange', state);
  }

  // ========================================================================
  // Getters
  // ========================================================================

  get isConnected(): boolean {
    return this.sdk?.isConnected ?? false;
  }

  get currentState(): AcpConnectionState {
    return this.state;
  }

  get currentSessionId(): string | null {
    return this._sessionId ?? this.sdk?.getSessionId() ?? null;
  }

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

// ============================================================================
// Export
// ============================================================================

export default SdkClient;

// 导出 SDK 类型供外部使用
export type {
  IFlowOptions,
  AuthMethodInfo,
  MCPServerConfig,
  HookConfigs,
  CommandConfig,
  SubAgentConfig,
  SessionSettings,
  IFlowClientInstance,
  AgentInfo,
  SDKMessage,
  AssistantMessage,
  ToolCallMessage,
  PlanMessage,
  TaskFinishMessage,
  ErrorMessage,
};

// 导出错误类型
export {
  ConnectionError,
  TimeoutError,
};

// 导出枚举
export { MessageType };