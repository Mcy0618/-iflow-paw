/**
 * Connection Factory - 连接工厂
 * 
 * 根据配置创建 SDK 或 ACP 连接，支持：
 * - 自动选择连接类型
 * - SDK 失败时自动降级到 ACP
 * - 连接状态持久化
 */

import { IConnection, ConnectionOptions, CONNECTION_TYPES } from './interface';
import { SdkClient } from './sdkClient';
import { AcpConnection } from './connection';
import { AcpConnectionState } from './types';

// ============================================================================
// Factory Types
// ============================================================================

export interface ConnectionFactoryResult {
  connection: IConnection;
  type: 'sdk' | 'acp';
  fallback: boolean; // 是否发生降级
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
  private currentType: 'sdk' | 'acp' | null = null;
  private options: ConnectionOptions;
  
  // 防止并发创建连接
  private pendingConnection: Promise<ConnectionFactoryResult> | null = null;

  private constructor(options: ConnectionOptions = { type: 'auto' }) {
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
   */
  async createConnection(options?: Partial<ConnectionOptions>): Promise<ConnectionFactoryResult> {
    // 如果已有连接且已连接成功，直接返回
    if (this.currentConnection && this.currentConnection.isConnected) {
      console.log('[ConnectionFactory] Reusing existing connection, type:', this.currentType);
      return {
        connection: this.currentConnection,
        type: this.currentType!,
        fallback: false,
      };
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

    switch (mergedOptions.type) {
      case CONNECTION_TYPES.SDK:
        return this.createSdkConnection(mergedOptions);
      
      case CONNECTION_TYPES.ACP:
        return this.createAcpConnection(mergedOptions);
      
      case CONNECTION_TYPES.AUTO:
      default:
        return this.createAutoConnection(mergedOptions);
    }
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

  /**
   * 创建 ACP 连接
   */
  private async createAcpConnection(options: ConnectionOptions): Promise<ConnectionFactoryResult> {
    console.log('[ConnectionFactory] Creating ACP connection...');
    
    const connection = new AcpConnection({
      port: options.acp?.port,
      host: options.acp?.host,
    });
    
    try {
      await connection.connect();
      this.currentConnection = connection;
      this.currentType = 'acp';
      
      console.log('[ConnectionFactory] ACP connection created successfully');
      
      return {
        connection,
        type: 'acp',
        fallback: false,
      };
    } catch (error) {
      console.error('[ConnectionFactory] ACP connection failed:', error);
      throw error;
    }
  }

  /**
   * 自动创建连接（优先 SDK，降级 ACP）
   */
  private async createAutoConnection(options: ConnectionOptions): Promise<ConnectionFactoryResult> {
    console.log('[ConnectionFactory] Creating auto connection (SDK with ACP fallback)...');
    
    // 尝试 SDK 连接
    try {
      const result = await this.createSdkConnection(options);
      console.log('[ConnectionFactory] Auto connection resolved to SDK');
      return result;
    } catch (sdkError) {
      console.warn('[ConnectionFactory] SDK connection failed, falling back to ACP:', sdkError);
      
      // 降级到 ACP
      try {
        const result = await this.createAcpConnection(options);
        console.log('[ConnectionFactory] Auto connection resolved to ACP (fallback)');
        
        return {
          ...result,
          fallback: true,
        };
      } catch (acpError) {
        console.error('[ConnectionFactory] Both SDK and ACP connections failed');
        throw new Error(
          `Connection failed: SDK error: ${sdkError instanceof Error ? sdkError.message : String(sdkError)}; ` +
          `ACP error: ${acpError instanceof Error ? acpError.message : String(acpError)}`
        );
      }
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
  getCurrentType(): 'sdk' | 'acp' | null {
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
   * 断开并销毁连接
   */
  async destroy(): Promise<void> {
    if (this.currentConnection) {
      await this.currentConnection.disconnect();
      this.currentConnection = null;
      this.currentType = null;
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
  static async getRecommendedType(): Promise<'sdk' | 'acp'> {
    const sdkAvailable = await ConnectionFactory.isSdkAvailable();
    return sdkAvailable ? 'sdk' : 'acp';
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * 创建默认连接（自动选择）
 */
export async function createDefaultConnection(): Promise<ConnectionFactoryResult> {
  const factory = ConnectionFactory.getInstance({ type: 'auto' });
  return factory.createConnection();
}

/**
 * 创建 SDK 连接
 */
export async function createSdkConnection(sdkOptions?: ConnectionOptions['sdk']): Promise<ConnectionFactoryResult> {
  const factory = ConnectionFactory.getInstance({ type: 'sdk', sdk: sdkOptions });
  return factory.createConnection();
}

/**
 * 创建 ACP 连接
 */
export async function createAcpConnection(acpOptions?: ConnectionOptions['acp']): Promise<ConnectionFactoryResult> {
  const factory = ConnectionFactory.getInstance({ type: 'acp', acp: acpOptions });
  return factory.createConnection();
}

// ============================================================================
// Export
// ============================================================================

export default ConnectionFactory;
