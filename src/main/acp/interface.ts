/**
 * IConnection - 统一连接接口
 * 
 * 定义 SDK 连接和 ACP 连接的统一接口，支持透明切换和降级。
 * 所有连接实现必须遵循此接口。
 */

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

// ============================================================================
// Connection Interface
// ============================================================================

export interface IConnection {
  // ========================================================================
  // 连接生命周期
  // ========================================================================
  
  /**
   * 建立连接
   */
  connect(): Promise<void>;
  
  /**
   * 断开连接
   */
  disconnect(): Promise<void>;
  
  // ========================================================================
  // 会话管理
  // ========================================================================
  
  /**
   * 初始化连接
   */
  initialize(): Promise<{ serverInfo: { name: string; version: string } }>;
  
  /**
   * 创建或加载会话
   */
  newSession(params: AcpNewSessionParams): Promise<AcpNewSessionResult>;
  
  // ========================================================================
  // 核心功能
  // ========================================================================
  
  /**
   * 发送 Prompt 请求
   */
  sendPrompt(params: AcpPromptParams): Promise<AcpPromptResult>;
  
  /**
   * 设置会话模式
   */
  setMode(params: AcpSetModeParams): Promise<AcpSetModeResult>;
  
  /**
   * 设置模型
   */
  setModel(params: AcpSetModelParams): Promise<AcpSetModelResult>;
  
  /**
   * 设置深度思考
   */
  setDeepThinking(params: AcpSetDeepThinkingParams): Promise<AcpSetDeepThinkingResult>;
  
  // ========================================================================
  // 状态属性
  // ========================================================================
  
  /**
   * 连接是否已建立
   */
  readonly isConnected: boolean;
  
  /**
   * 当前连接状态
   */
  readonly currentState: AcpConnectionState;
  
  /**
   * 当前会话 ID
   */
  readonly currentSessionId: string | null;
  
  /**
   * 当前模式
   */
  getCurrentMode(): SupportedMode;
  
  /**
   * 当前模型
   */
  getCurrentModel(): SupportedModel;
  
  /**
   * 深度思考是否启用
   */
  isDeepThinkingEnabled(): boolean;
  
  /**
   * 深度思考级别
   */
  getDeepThinkingLevel(): number;
  
  // ========================================================================
  // 事件
  // ========================================================================
  
  /**
   * 注册事件监听器
   */
  on(event: 'update', listener: (data: { sessionId: string; update: SessionUpdate }) => void): this;
  on(event: 'stateChange', listener: (state: AcpConnectionState) => void): this;
  on(event: 'connected', listener: () => void): this;
  on(event: 'disconnected', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'stderr', listener: (data: string) => void): this;
  
  /**
   * 移除事件监听器
   */
  off(event: string, listener: (...args: any[]) => void): this;
  
  /**
   * 移除所有事件监听器
   */
  removeAllListeners(): this;
  
  /**
   * 触发事件
   */
  emit(event: string, ...args: any[]): boolean;
}

// ============================================================================
// Connection Options
// ============================================================================

export interface ConnectionOptions {
  /**
   * 连接类型：'sdk' | 'acp' | 'auto'
   * - sdk: 强制使用 SDK
   * - acp: 强制使用 ACP
   * - auto: 自动选择，SDK 失败时降级到 ACP
   */
  type: 'sdk' | 'acp' | 'auto';
  
  /**
   * ACP 连接选项
   */
  acp?: {
    port?: number;
    host?: string;
  };
  
  /**
   * SDK 连接选项
   */
  sdk?: {
    /**
     * SDK 配置路径
     */
    configPath?: string;
    
    /**
     * 自动启动进程
     */
    autoStart?: boolean;
    
    /**
     * 连接 URL（手动模式）
     */
    url?: string;
    
    /**
     * 工作目录
     */
    workingDir?: string;
  };
}

// ============================================================================
// Connection Type Constants
// ============================================================================

export const CONNECTION_TYPES = {
  SDK: 'sdk',
  ACP: 'acp',
  AUTO: 'auto',
} as const;

export type ConnectionType = typeof CONNECTION_TYPES[keyof typeof CONNECTION_TYPES];
