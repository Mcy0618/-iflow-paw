/**
 * OpenAI Compatible Provider - OpenAI 兼容 Provider 实现
 * 
 * 使用 openai npm 包实现 OpenAI 兼容 API 调用：
 * - 支持流式响应
 * - 支持深度思考模型（DeepSeek Reasoner 等）
 * - 支持多种国产大模型 API
 */

import { EventEmitter } from 'events';
import {
  ModelProvider,
  ProviderModel,
  ProviderOptions,
  ChatMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
  MessageRole,
} from './types';

// ============================================================================
// OpenAI SDK Types (动态导入)
// ============================================================================

/**
 * OpenAI SDK 类型定义
 * 如果 SDK 未安装，这些类型将不可用
 */
interface OpenAIClient {
  chat: {
    completions: {
      // @ts-ignore - OpenAI SDK 类型复杂
      create(params: OpenAIChatParams): Promise<OpenAIChatResponse>;
      // @ts-ignore - OpenAI SDK 类型复杂
      create(params: OpenAIChatStreamParams): Promise<AsyncIterable<OpenAIStreamChunk>>;
    };
  };
}

interface OpenAIChatParams {
  model: string;
  messages: Array<{
    role: string;
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    name?: string;
    tool_call_id?: string;
    tool_calls?: Array<{
      id: string;
      type: string;
      function: { name: string; arguments: string };
    }>;
  }>;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string[];
  frequency_penalty?: number;
  presence_penalty?: number;
  tools?: Array<{
    type: string;
    function: {
      name: string;
      description?: string;
      parameters?: Record<string, unknown>;
    };
  }>;
  tool_choice?: string | { type: string; function: { name: string } };
}

interface OpenAIChatStreamParams extends OpenAIChatParams {
  stream: true;
}

interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }>;
      reasoning_content?: string; // DeepSeek 思考内容
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================================================
// OpenAI Provider Implementation
// ============================================================================

export class OpenAICompatibleProvider extends EventEmitter {
  private client: OpenAIClient | null = null;
  // @ts-ignore - OpenAI SDK 类型复杂，使用 any
  private openai: any = null;
  private provider: ModelProvider;
  private options: ProviderOptions;
  private initialized: boolean = false;

  constructor(provider: ModelProvider, options: ProviderOptions = {}) {
    super();
    this.provider = provider;
    this.options = {
      timeout: 60000,
      maxRetries: 3,
      ...options,
    };
  }

  // ========================================================================
  // Initialization
  // ========================================================================

  /**
   * 初始化 Provider
   * 动态加载 OpenAI SDK
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // 动态加载 OpenAI SDK
    try {
      // @ts-ignore - 动态导入
      const openaiModule = await import('openai');
      this.openai = openaiModule.default || openaiModule;
    } catch (error) {
      throw new Error(
        `OpenAI SDK not installed. Please install: npm install openai\n` +
        `Original error: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // 验证 API Key
    const apiKey = this.options.apiKey || this.provider.apiKey;
    if (!apiKey) {
      throw new Error(`API Key is required for provider: ${this.provider.name}`);
    }

    // 创建客户端
    const baseURL = this.options.baseUrl || this.provider.baseUrl;
    
    this.client = new this.openai!({
      apiKey,
      baseURL,
      dangerouslyAllowBrowser: true, // 允许在 Electron 渲染进程使用
    });

    this.initialized = true;
    console.log(`[OpenAIProvider] Initialized: ${this.provider.name} (${baseURL})`);
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ========================================================================
  // Chat Completion
  // ========================================================================

  /**
   * 发送聊天请求
   * 
   * 注意：支持任意模型 ID，不做本地验证，直接传递给 OpenAI SDK
   * 这允许用户使用自定义模型或最新的模型而无需更新代码
   */
  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    await this.ensureInitialized();

    const params: OpenAIChatParams = {
      // 直接传递模型 ID，支持任意模型（包括自定义模型和最新模型）
      model: request.model,
      messages: this.convertMessages(request.messages),
      temperature: request.temperature,
      top_p: request.topP,
      max_tokens: request.maxTokens,
      stop: request.stop,
      frequency_penalty: request.frequencyPenalty,
      presence_penalty: request.presencePenalty,
      tools: request.tools,
      tool_choice: request.toolChoice as string,
      stream: false,
    };

    // 移除 undefined 值
    Object.keys(params).forEach(key => {
      if (params[key as keyof OpenAIChatParams] === undefined) {
        delete params[key as keyof OpenAIChatParams];
      }
    });

    try {
      const response = await this.client!.chat.completions.create(params as OpenAIChatParams);
      return this.convertResponse(response as OpenAIChatResponse);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * 发送流式聊天请求
   * 
   * 注意：支持任意模型 ID，不做本地验证，直接传递给 OpenAI SDK
   * 这允许用户使用自定义模型或最新的模型而无需更新代码
   */
  async *chatStream(request: ChatCompletionRequest): AsyncGenerator<StreamChunk> {
    await this.ensureInitialized();

    const params: OpenAIChatStreamParams = {
      // 直接传递模型 ID，支持任意模型（包括自定义模型和最新模型）
      model: request.model,
      messages: this.convertMessages(request.messages),
      temperature: request.temperature,
      top_p: request.topP,
      max_tokens: request.maxTokens,
      stop: request.stop,
      frequency_penalty: request.frequencyPenalty,
      presence_penalty: request.presencePenalty,
      tools: request.tools,
      tool_choice: request.toolChoice as string,
      stream: true,
    };

    // 移除 undefined 值
    Object.keys(params).forEach(key => {
      if (params[key as keyof OpenAIChatStreamParams] === undefined) {
        delete params[key as keyof OpenAIChatStreamParams];
      }
    });

    try {
      // @ts-ignore - OpenAI SDK 返回类型复杂
      const stream = await this.client!.chat.completions.create(params);
      
      let responseId = '';
      let model = request.model;

      // @ts-ignore - OpenAI SDK 返回类型复杂
      for await (const chunk of stream) {
        responseId = chunk.id || responseId;
        model = chunk.model || model;

        const choice = chunk.choices[0];
        if (!choice) continue;

        const delta = choice.delta;
        
        // 处理普通内容
        if (delta.content) {
          yield {
            id: responseId,
            type: 'content',
            content: delta.content,
          };
        }

        // 处理思考内容（DeepSeek Reasoner 等）
        if ((delta as any).reasoning_content) {
          yield {
            id: responseId,
            type: 'thought',
            thought: (delta as any).reasoning_content,
          };
        }

        // 处理结束
        if (choice.finish_reason) {
          yield {
            id: responseId,
            type: 'done',
            finishReason: choice.finish_reason as 'stop' | 'length' | 'content_filter' | 'error',
          };
        }

        // 处理 usage
        if (chunk.usage) {
          yield {
            id: responseId,
            type: 'usage',
            usage: {
              promptTokens: chunk.usage.prompt_tokens,
              completionTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            },
          };
        }
      }
    } catch (error) {
      yield {
        id: '',
        type: 'error',
        error: {
          code: 'stream_error',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  // ========================================================================
  // Message Conversion
  // ========================================================================

  /**
   * 转换消息格式
   */
  private convertMessages(messages: ChatMessage[]): OpenAIChatParams['messages'] {
    return messages.map(msg => {
      // 处理字符串内容
      if (typeof msg.content === 'string') {
        return {
          role: msg.role,
          content: msg.content,
          name: msg.name,
          tool_call_id: msg.toolCallId,
          tool_calls: msg.toolCalls?.map(tc => ({
            id: tc.id,
            type: tc.type,
            function: tc.function,
          })),
        };
      }

      // 处理多部分内容
      return {
        role: msg.role,
        content: msg.content.map(part => {
          if (part.type === 'text') {
            return { type: 'text', text: part.text };
          }
          if (part.type === 'image_url' && part.imageUrl) {
            return { type: 'image_url', image_url: { url: part.imageUrl.url } };
          }
          return part;
        }),
        name: msg.name,
        tool_call_id: msg.toolCallId,
        tool_calls: msg.toolCalls?.map(tc => ({
          id: tc.id,
          type: tc.type,
          function: tc.function,
        })),
      };
    });
  }

  /**
   * 转换响应格式
   */
  private convertResponse(response: OpenAIChatResponse): ChatCompletionResponse {
    return {
      id: response.id,
      object: response.object as 'chat.completion',
      created: response.created,
      model: response.model,
      choices: response.choices.map(choice => ({
        index: choice.index,
        message: {
          role: choice.message.role as MessageRole,
          content: choice.message.content || '',
          toolCalls: choice.message.tool_calls?.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: tc.function,
          })),
        },
        finishReason: choice.finish_reason,
      })),
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    };
  }

  // ========================================================================
  // Error Handling
  // ========================================================================

  /**
   * 处理错误
   */
  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      // API 错误
      if ('status' in error) {
        const apiError = error as any;
        return new Error(
          `API Error (${apiError.status}): ${apiError.message || 'Unknown error'}`
        );
      }
      return error;
    }
    return new Error(String(error));
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * 确保已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * 获取 Provider 信息
   */
  getProvider(): ModelProvider {
    return this.provider;
  }

  /**
   * 获取可用模型列表
   */
  getModels(): ProviderModel[] {
    return this.provider.models;
  }

  /**
   * 更新 API Key
   */
  updateApiKey(apiKey: string): void {
    this.options.apiKey = apiKey;
    this.initialized = false;
    this.client = null;
  }

  /**
   * 更新基础 URL
   */
  updateBaseUrl(baseUrl: string): void {
    this.options.baseUrl = baseUrl;
    this.initialized = false;
    this.client = null;
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    this.client = null;
    this.openai = null;
    this.initialized = false;
    this.removeAllListeners();
  }
}

// ============================================================================
// Provider Factory
// ============================================================================

/**
 * 创建 OpenAI 兼容 Provider
 */
export async function createOpenAIProvider(
  provider: ModelProvider,
  options?: ProviderOptions
): Promise<OpenAICompatibleProvider> {
  const instance = new OpenAICompatibleProvider(provider, options);
  await instance.initialize();
  return instance;
}

// ============================================================================
// Export
// ============================================================================

export default OpenAICompatibleProvider;
