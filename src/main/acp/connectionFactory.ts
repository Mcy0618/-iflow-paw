/**
 * Connection Factory - 连接工厂
 * 
 * 根据配置创建 SDK 连接，仅支持 SDK 模式。
 */

import { IConnection, ConnectionOptions } from './interface';
import { SdkClient } from './sdkClient';
import { AcpConnectionState } from './types';

// ============================================================================
// Factory Types
// ============================================================================

export interface ConnectionFactoryResult {
  connection: IConnection;
  type: 'sdk';
  fallback: boolean;
}

export interface ConnectionFactoryEvents {
  'connection-created': (result: ConnectionFactoryResult) => void;
  'fallback-triggered': (reason: string) => void;
  'connection-error': (error: Error) => void;
}

// ============================================================================
// Connection Factory
// ============================================================================

export class ConnectionFactory {
  private static instance: ConnectionFactory | null = null;
  private currentConnection: IConnection | null = null;
  private currentType: 'sdk' | null = null;
  private currentWorkingDir: string | null = null; // 跟踪当前工作目录
  private options: ConnectionOptions;
  
  // 防止并发创建连接
  private pendingConnection: Promise<ConnectionFactoryResult> | null = null;

  private constructor(options: ConnectionOptions = { type: 'sdk' }) {
    this.options = options;
  }

  /**
   * 获取单例实例
   */
  static getInstance(options?: ConnectionOptions): ConnectionFactory {
    if (!ConnectionFactory.instance) {
      ConnectionFactory.instance = new ConnectionFactory(options);
    }
    return ConnectionFactory.instance;
  }

  /**
   * 重置工厂（用于测试）
   */
  static reset(): void {
    if (ConnectionFactory.instance) {
      ConnectionFactory.instance.destroy();
      ConnectionFactory.instance = null;
    }
  }

  // ========================================================================
  // Connection Creation
  // ========================================================================

  /**
   * 创建连接
   * 
   * 根据配置创建 SDK 或 ACP 连接：
   * - 'sdk': 强制使用 SDK，失败则抛出错误
   * - 'acp': 强制使用 ACP
   * - 'auto': 优先使用 SDK，失败时降级到 ACP
   * 
   * 如果请求的工作目录与当前不同，会断开旧连接并重建
   */
  async createConnection(options?: Partial<ConnectionOptions>): Promise<ConnectionFactoryResult> {
    // 获取请求的工作目录
    const requestedWorkingDir = options?.sdk?.workingDir || this.options.sdk?.workingDir || null;
    
    // 如果已有连接，检查工作目录是否变化
    if (this.currentConnection && this.currentConnection.isConnected) {
      // 工作目录变化时，强制断开并重建连接
      if (requestedWorkingDir && this.currentWorkingDir !== requestedWorkingDir) {
        console.log('[ConnectionFactory] Working directory changed from', this.currentWorkingDir, 'to', requestedWorkingDir, '- rebuilding connection');
        await this.destroy();
      } else {
        console.log('[ConnectionFactory] Reusing existing connection, type:', this.currentType);
        return {
          connection: this.currentConnection,
          type: this.currentType!,
          fallback: false,
        };
      }
    }
    
    // 如果正在创建连接，等待它完成
    if (this.pendingConnection) {
      console.log('[ConnectionFactory] Connection creation in progress, waiting...');
      return this.pendingConnection;
    }
    
    // 开始创建连接
    this.pendingConnection = this._doCreateConnection(options);
    
    try {
      const result = await this.pendingConnection;
      // 更新当前工作目录
      this.currentWorkingDir = requestedWorkingDir;
      return result;
    } finally {
      this.pendingConnection = null;
    }
  }

  /**
   * 内部创建连接实现
   */
  private async _doCreateConnection(options?: Partial<ConnectionOptions>): Promise<ConnectionFactoryResult> {
    const mergedOptions = this.mergeOptions(options);
    
    // 如果已有连接，先断开
    if (this.currentConnection) {
      await this.currentConnection.disconnect();
      this.currentConnection = null;
      this.currentType = null;
    }

    // 仅支持 SDK 连接
    return this.createSdkConnection(mergedOptions);
  }

  /**
   * 创建 SDK 连接
   */
  private async createSdkConnection(options: ConnectionOptions): Promise<ConnectionFactoryResult> {
    console.log('[ConnectionFactory] Creating SDK connection...');
    
    const connection = new SdkClient(options.sdk);
    
    try {
      await connection.connect();
      this.currentConnection = connection;
      this.currentType = 'sdk';
      
      console.log('[ConnectionFactory] SDK connection created successfully');
      
      return {
        connection,
        type: 'sdk',
        fallback: false,
      };
    } catch (error) {
      console.error('[ConnectionFactory] SDK connection failed:', error);
      throw error;
    }
  }

  // ========================================================================
  // Connection Management
  // ========================================================================

  /**
   * 获取当前连接
   */
  getCurrentConnection(): IConnection | null {
    return this.currentConnection;
  }

  /**
   * 获取当前连接类型
   */
  getCurrentType(): 'sdk' | null {
    return this.currentType;
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.currentConnection?.isConnected ?? false;
  }

  /**
   * 获取当前连接状态
   */
  getState(): AcpConnectionState | null {
    return this.currentConnection?.currentState ?? null;
  }

  /**
   * 获取当前工作目录
   */
  getCurrentWorkingDir(): string | null {
    return this.currentWorkingDir;
  }

  /**
   * 断开并销毁连接
   */
  async destroy(): Promise<void> {
    if (this.currentConnection) {
      await this.currentConnection.disconnect();
      this.currentConnection = null;
      this.currentType = null;
      this.currentWorkingDir = null;
    }
  }

  // ========================================================================
  // Options Management
  // ========================================================================

  /**
   * 更新配置
   */
  updateOptions(options: Partial<ConnectionOptions>): void {
    this.options = this.mergeOptions(options);
  }

  /**
   * 合并配置
   */
  private mergeOptions(options?: Partial<ConnectionOptions>): ConnectionOptions {
    return {
      ...this.options,
      ...options,
      acp: {
        ...this.options.acp,
        ...options?.acp,
      },
      sdk: {
        ...this.options.sdk,
        ...options?.sdk,
      },
    };
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * 检查 SDK 是否可用
   */
  static async isSdkAvailable(): Promise<boolean> {
    try {
      // @ts-ignore - 动态导入可能不存在的包
      await import('@iflow-ai/iflow-cli-sdk');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取推荐连接类型
   */
  static async getRecommendedType(): Promise<'sdk'> {
    // 仅支持 SDK
    return 'sdk';
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * 创建默认连接（SDK 模式）
 */
export async function createDefaultConnection(): Promise<ConnectionFactoryResult> {
  const factory = ConnectionFactory.getInstance({ type: 'sdk' });
  return factory.createConnection();
}

/**
 * 创建 SDK 连接
 */
export async function createSdkConnection(sdkOptions?: ConnectionOptions['sdk']): Promise<ConnectionFactoryResult> {
  const factory = ConnectionFactory.getInstance({ type: 'sdk', sdk: sdkOptions });
  return factory.createConnection();
}

// ============================================================================
// Export
// ============================================================================

export default ConnectionFactory;
