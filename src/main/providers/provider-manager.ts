/**
 * Provider Manager - Provider 管理器
 * 
 * 管理多个 OpenAI 兼容 Provider：
 * - 添加/删除/切换 Provider
 * - 配置持久化
 * - 模型选择
 */

import { EventEmitter } from 'events';
import { OpenAICompatibleProvider } from './openai-provider';
import {
  ModelProvider,
  ProviderModel,
  PRESET_PROVIDERS,
  validateProviderConfig,
  ChatMessage,
  ChatCompletionRequest,
  StreamChunk,
} from './types';

// ============================================================================
// Manager Types
// ============================================================================

export interface ProviderManagerConfig {
  /** 活跃 Provider ID */
  activeProviderId: string;
  
  /** 活跃模型 ID */
  activeModelId: string;
  
  /** 用户自定义 Provider 列表 */
  customProviders: ModelProvider[];
  
  /** Provider API Keys */
  apiKeys: Record<string, string>;
}

export interface ProviderManagerEvents {
  'provider-added': (provider: ModelProvider) => void;
  'provider-removed': (providerId: string) => void;
  'provider-switched': (provider: ModelProvider) => void;
  'model-switched': (model: ProviderModel) => void;
  'config-saved': () => void;
  'config-loaded': () => void;
  'error': (error: Error) => void;
}

// ============================================================================
// Provider Manager
// ============================================================================

export class ProviderManager extends EventEmitter {
  private providers: Map<string, ModelProvider> = new Map();
  private providerInstances: Map<string, OpenAICompatibleProvider> = new Map();
  private config: ProviderManagerConfig;
  private configStore: ProviderConfigStore | null = null;

  constructor(config?: Partial<ProviderManagerConfig>) {
    super();
    
    // 初始化配置
    this.config = {
      activeProviderId: config?.activeProviderId || 'deepseek',
      activeModelId: config?.activeModelId || 'deepseek-chat',
      customProviders: config?.customProviders || [],
      apiKeys: config?.apiKeys || {},
    };

    // 加载预设 Provider
    this.loadPresetProviders();
    
    // 加载自定义 Provider
    this.loadCustomProviders();
  }

  // ========================================================================
  // Provider Management
  // ========================================================================

  /**
   * 加载预设 Provider
   */
  private loadPresetProviders(): void {
    for (const provider of PRESET_PROVIDERS) {
      this.providers.set(provider.id, {
        ...provider,
        apiKey: this.config.apiKeys[provider.id],
      });
    }
  }

  /**
   * 加载自定义 Provider
   */
  private loadCustomProviders(): void {
    for (const provider of this.config.customProviders) {
      this.providers.set(provider.id, {
        ...provider,
        apiKey: this.config.apiKeys[provider.id],
      });
    }
  }

  /**
   * 获取所有 Provider
   */
  getAllProviders(): ModelProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * 获取 Provider
   */
  getProvider(providerId: string): ModelProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * 添加自定义 Provider
   */
  addProvider(provider: ModelProvider): { success: boolean; errors: string[] } {
    // 验证配置
    const validation = validateProviderConfig(provider);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    // 检查是否已存在
    if (this.providers.has(provider.id)) {
      return { success: false, errors: [`Provider with ID "${provider.id}" already exists`] };
    }

    // 保存 API Key 到配置
    if (provider.apiKey) {
      this.config.apiKeys[provider.id] = provider.apiKey;
    }

    // 添加 Provider（包含 apiKey 以便立即使用）
    this.providers.set(provider.id, {
      ...provider,
      isPreset: false,
      apiKey: provider.apiKey || this.config.apiKeys[provider.id],
    });

    // 添加到自定义 Provider 列表（不包含 apiKey，避免重复存储）
    const { apiKey, ...providerWithoutKey } = provider;
    this.config.customProviders.push(providerWithoutKey);

    // 触发事件
    this.emit('provider-added', provider);

    // 保存配置
    this.saveConfig();

    return { success: true, errors: [] };
  }

  /**
   * 移除自定义 Provider
   */
  removeProvider(providerId: string): boolean {
    const provider = this.providers.get(providerId);
    
    // 检查是否存在
    if (!provider) {
      return false;
    }

    // 不能移除预设 Provider
    if (provider.isPreset) {
      console.warn(`[ProviderManager] Cannot remove preset provider: ${providerId}`);
      return false;
    }

    // 销毁实例
    const instance = this.providerInstances.get(providerId);
    if (instance) {
      instance.destroy();
      this.providerInstances.delete(providerId);
    }

    // 移除 Provider
    this.providers.delete(providerId);

    // 从自定义列表中移除
    this.config.customProviders = this.config.customProviders.filter(p => p.id !== providerId);

    // 如果移除的是活跃 Provider，切换到默认
    if (this.config.activeProviderId === providerId) {
      this.setActiveProvider('deepseek');
    }

    // 触发事件
    this.emit('provider-removed', providerId);

    // 保存配置
    this.saveConfig();

    return true;
  }

  /**
   * 更新 Provider 配置
   */
  updateProvider(providerId: string, updates: Partial<ModelProvider>): boolean {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return false;
    }

    // 更新配置
    this.providers.set(providerId, {
      ...provider,
      ...updates,
    });

    // 更新 API Key 存储
    if (updates.apiKey) {
      this.config.apiKeys[providerId] = updates.apiKey;
    }

    // 销毁现有实例（下次使用时重新创建）
    const instance = this.providerInstances.get(providerId);
    if (instance) {
      instance.destroy();
      this.providerInstances.delete(providerId);
    }

    // 保存配置
    this.saveConfig();

    return true;
  }

  // ========================================================================
  // Active Provider & Model
  // ========================================================================

  /**
   * 获取活跃 Provider
   */
  getActiveProvider(): ModelProvider | undefined {
    return this.providers.get(this.config.activeProviderId);
  }

  /**
   * 设置活跃 Provider
   */
  async setActiveProvider(providerId: string): Promise<boolean> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return false;
    }

    this.config.activeProviderId = providerId;

    // 设置默认模型
    if (provider.models.length > 0 && !provider.models.find(m => m.id === this.config.activeModelId)) {
      this.config.activeModelId = provider.models[0].id;
    }

    // 触发事件
    this.emit('provider-switched', provider);

    // 保存配置
    this.saveConfig();

    return true;
  }

  /**
   * 获取活跃模型
   */
  getActiveModel(): ProviderModel | undefined {
    const provider = this.getActiveProvider();
    return provider?.models.find(m => m.id === this.config.activeModelId);
  }

  /**
   * 设置活跃模型
   */
  setActiveModel(modelId: string): boolean {
    const provider = this.getActiveProvider();
    if (!provider) {
      return false;
    }

    const model = provider.models.find(m => m.id === modelId);
    if (!model) {
      return false;
    }

    this.config.activeModelId = modelId;

    // 触发事件
    this.emit('model-switched', model);

    // 保存配置
    this.saveConfig();

    return true;
  }

  // ========================================================================
  // API Key Management
  // ========================================================================

  /**
   * 设置 Provider API Key
   */
  setApiKey(providerId: string, apiKey: string): boolean {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return false;
    }

    // 更新配置
    this.config.apiKeys[providerId] = apiKey;
    provider.apiKey = apiKey;

    // 销毁现有实例
    const instance = this.providerInstances.get(providerId);
    if (instance) {
      instance.destroy();
      this.providerInstances.delete(providerId);
    }

    // 保存配置
    this.saveConfig();

    return true;
  }

  /**
   * 获取 Provider API Key
   */
  getApiKey(providerId: string): string | undefined {
    return this.config.apiKeys[providerId] || this.providers.get(providerId)?.apiKey;
  }

  // ========================================================================
  // Chat Operations
  // ========================================================================

  /**
   * 获取 Provider 实例
   */
  private async getProviderInstance(providerId: string): Promise<OpenAICompatibleProvider> {
    // 检查缓存
    let instance = this.providerInstances.get(providerId);
    if (instance && instance.isInitialized()) {
      return instance;
    }

    // 获取 Provider 配置
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    // 检查 API Key
    if (!provider.apiKey) {
      throw new Error(`API Key not configured for provider: ${provider.name}`);
    }

    // 创建新实例
    instance = new OpenAICompatibleProvider(provider, {
      apiKey: provider.apiKey,
    });
    await instance.initialize();

    // 缓存实例
    this.providerInstances.set(providerId, instance);

    return instance;
  }

  /**
   * 发送聊天请求
   */
  async chat(
    messages: ChatMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    const providerId = this.config.activeProviderId;
    const modelId = options?.model || this.config.activeModelId;

    const instance = await this.getProviderInstance(providerId);

    const request: ChatCompletionRequest = {
      model: modelId,
      messages,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      stream: false,
    };

    const response = await instance.chat(request);
    const content = response.choices[0]?.message?.content;
    if (typeof content === 'string') {
      return content;
    }
    // 处理多部分内容，提取文本
    if (Array.isArray(content)) {
      return content.map(part => part.text || '').join('');
    }
    return '';
  }

  /**
   * 发送流式聊天请求
   */
  async *chatStream(
    messages: ChatMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): AsyncGenerator<StreamChunk> {
    const providerId = this.config.activeProviderId;
    const modelId = options?.model || this.config.activeModelId;

    const instance = await this.getProviderInstance(providerId);

    const request: ChatCompletionRequest = {
      model: modelId,
      messages,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      stream: true,
    };

    yield* instance.chatStream(request);
  }

  // ========================================================================
  // Config Persistence
  // ========================================================================

  /**
   * 设置配置存储
   */
  setConfigStore(store: ProviderConfigStore): void {
    this.configStore = store;
  }

  /**
   * 保存配置
   */
  async saveConfig(): Promise<void> {
    if (!this.configStore) {
      return;
    }

    try {
      await this.configStore.save(this.config);
      this.emit('config-saved');
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 加载配置
   */
  async loadConfig(): Promise<void> {
    if (!this.configStore) {
      return;
    }

    try {
      const config = await this.configStore.load();
      if (config) {
        this.config = {
          ...this.config,
          ...config,
        };
        
        // 重新加载 Provider
        this.loadCustomProviders();
        
        this.emit('config-loaded');
      }
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 导出配置
   */
  exportConfig(): ProviderManagerConfig {
    return { ...this.config };
  }

  /**
   * 导入配置
   */
  importConfig(config: Partial<ProviderManagerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
    
    // 重新加载 Provider
    this.loadCustomProviders();
    
    // 保存配置
    this.saveConfig();
  }

  // ========================================================================
  // Cleanup
  // ========================================================================

  /**
   * 销毁管理器
   */
  destroy(): void {
    // 销毁所有 Provider 实例
    for (const instance of this.providerInstances.values()) {
      instance.destroy();
    }
    
    this.providerInstances.clear();
    this.providers.clear();
    this.removeAllListeners();
  }
}

// ============================================================================
// Config Store Interface
// ============================================================================

/**
 * 配置存储接口
 */
export interface ProviderConfigStore {
  load(): Promise<ProviderManagerConfig | null>;
  save(config: ProviderManagerConfig): Promise<void>;
}

/**
 * 内存配置存储（默认实现）
 */
export class MemoryConfigStore implements ProviderConfigStore {
  private config: ProviderManagerConfig | null = null;

  async load(): Promise<ProviderManagerConfig | null> {
    return this.config;
  }

  async save(config: ProviderManagerConfig): Promise<void> {
    this.config = { ...config };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let defaultManager: ProviderManager | null = null;

/**
 * 获取默认管理器实例
 */
export function getProviderManager(): ProviderManager {
  if (!defaultManager) {
    defaultManager = new ProviderManager();
  }
  return defaultManager;
}

/**
 * 重置默认管理器
 */
export function resetProviderManager(): void {
  if (defaultManager) {
    defaultManager.destroy();
    defaultManager = null;
  }
}

// ============================================================================
// Export
// ============================================================================

export default ProviderManager;
