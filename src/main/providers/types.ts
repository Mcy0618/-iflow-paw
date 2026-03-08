/**
 * Provider Types - Provider 类型定义
 * 
 * 定义 OpenAI 兼容 API Provider 的类型和预设供应商列表。
 * 支持多种国产大模型 API（DeepSeek、Moonshot、智谱等）。
 */

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Provider 模型定义
 */
export interface ProviderModel {
  /** 模型唯一标识 */
  id: string;
  
  /** 模型显示名称 */
  name: string;
  
  /** 模型描述 */
  description?: string;
  
  /** 是否支持深度思考/推理 */
  supportsThinking?: boolean;
  
  /** 是否支持视觉/图像输入 */
  supportsVision?: boolean;
  
  /** 是否支持函数调用 */
  supportsFunctionCall?: boolean;
  
  /** 最大上下文长度 */
  maxContextLength?: number;
  
  /** 最大输出长度 */
  maxOutputLength?: number;
  
  /** 输入价格（每 1M tokens，美元） */
  inputPrice?: number;
  
  /** 输出价格（每 1M tokens，美元） */
  outputPrice?: number;
}

/**
 * 模型供应商定义
 */
export interface ModelProvider {
  /** 供应商唯一标识 */
  id: string;
  
  /** 供应商显示名称 */
  name: string;
  
  /** API 基础 URL */
  baseUrl: string;
  
  /** API Key（运行时设置） */
  apiKey?: string;
  
  /** 可用模型列表 */
  models: ProviderModel[];
  
  /** 供应商描述 */
  description?: string;
  
  /** 供应商网站 */
  website?: string;
  
  /** API 文档链接 */
  docsUrl?: string;
  
  /** 是否启用 */
  enabled?: boolean;
  
  /** 自定义请求头 */
  customHeaders?: Record<string, string>;
  
  /** 是否为预设供应商（不可删除） */
  isPreset?: boolean;
}

/**
 * Provider 配置选项
 */
export interface ProviderOptions {
  /** API Key */
  apiKey?: string;
  
  /** 自定义基础 URL */
  baseUrl?: string;
  
  /** 默认模型 */
  defaultModel?: string;
  
  /** 请求超时（毫秒） */
  timeout?: number;
  
  /** 最大重试次数 */
  maxRetries?: number;
  
  /** 自定义请求头 */
  customHeaders?: Record<string, string>;
  
  /** 代理设置 */
  proxy?: {
    host: string;
    port: number;
    auth?: {
      username: string;
      password: string;
    };
  };
}

/**
 * 流式响应事件
 */
export interface StreamChunk {
  /** 内容块 ID */
  id: string;
  
  /** 块类型 */
  type: 'content' | 'thought' | 'usage' | 'error' | 'done';
  
  /** 内容文本 */
  content?: string;
  
  /** 思考内容（用于深度思考模型） */
  thought?: string;
  
  /** Token 使用情况 */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  
  /** 错误信息 */
  error?: {
    code: string;
    message: string;
  };
  
  /** 完成原因 */
  finishReason?: 'stop' | 'length' | 'content_filter' | 'error';
}

/**
 * 消息角色
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * 聊天消息
 */
export interface ChatMessage {
  /** 消息角色 */
  role: MessageRole;
  
  /** 消息内容 */
  content: string | ChatContentPart[];
  
  /** 名称（可选） */
  name?: string;
  
  /** 工具调用（可选） */
  toolCalls?: ToolCall[];
  
  /** 工具调用 ID（可选） */
  toolCallId?: string;
}

/**
 * 聊天内容部分
 */
export interface ChatContentPart {
  /** 内容类型 */
  type: 'text' | 'image_url';
  
  /** 文本内容 */
  text?: string;
  
  /** 图像 URL */
  imageUrl?: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

/**
 * 工具调用
 */
export interface ToolCall {
  /** 工具调用 ID */
  id: string;
  
  /** 工具类型 */
  type: 'function';
  
  /** 函数调用 */
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * 聊天完成请求
 */
export interface ChatCompletionRequest {
  /** 模型 ID */
  model: string;
  
  /** 消息列表 */
  messages: ChatMessage[];
  
  /** 是否流式响应 */
  stream?: boolean;
  
  /** 温度参数 */
  temperature?: number;
  
  /** Top P 参数 */
  topP?: number;
  
  /** 最大 Token 数 */
  maxTokens?: number;
  
  /** 停止序列 */
  stop?: string[];
  
  /** 频率惩罚 */
  frequencyPenalty?: number;
  
  /** 存在惩罚 */
  presencePenalty?: number;
  
  /** 工具列表 */
  tools?: ToolDefinition[];
  
  /** 工具选择策略 */
  toolChoice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
  
  /** 是否启用深度思考 */
  enableThinking?: boolean;
  
  /** 深度思考预算（Token 数） */
  thinkingBudget?: number;
}

/**
 * 工具定义
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

/**
 * 聊天完成响应
 */
export interface ChatCompletionResponse {
  /** 响应 ID */
  id: string;
  
  /** 对象类型 */
  object: 'chat.completion' | 'chat.completion.chunk';
  
  /** 创建时间戳 */
  created: number;
  
  /** 模型 ID */
  model: string;
  
  /** 选择列表 */
  choices: Array<{
    index: number;
    message?: ChatMessage;
    delta?: Partial<ChatMessage>;
    finishReason: string | null;
  }>;
  
  /** Token 使用情况 */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ============================================================================
// Preset Providers
// ============================================================================

/**
 * 预设供应商列表
 * 
 * 包含常见的 OpenAI 兼容 API 供应商
 */
export const PRESET_PROVIDERS: ModelProvider[] = [
  // DeepSeek
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    description: 'DeepSeek AI 大模型，支持深度思考模式',
    website: 'https://www.deepseek.com',
    docsUrl: 'https://platform.deepseek.com/docs',
    isPreset: true,
    models: [
      {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        description: '通用对话模型',
        supportsFunctionCall: true,
        maxContextLength: 64000,
        inputPrice: 0.14,
        outputPrice: 0.28,
      },
      {
        id: 'deepseek-reasoner',
        name: 'DeepSeek Reasoner',
        description: '深度推理模型，支持思维链',
        supportsThinking: true,
        maxContextLength: 64000,
        inputPrice: 0.55,
        outputPrice: 2.19,
      },
      {
        id: 'deepseek-coder',
        name: 'DeepSeek Coder',
        description: '代码专用模型',
        supportsFunctionCall: true,
        maxContextLength: 16000,
        inputPrice: 0.14,
        outputPrice: 0.28,
      },
    ],
  },

  // Moonshot (Kimi)
  {
    id: 'moonshot',
    name: 'Moonshot (Kimi)',
    baseUrl: 'https://api.moonshot.cn/v1',
    description: '月之暗面 Kimi 大模型，超长上下文',
    website: 'https://www.moonshot.cn',
    docsUrl: 'https://platform.moonshot.cn/docs',
    isPreset: true,
    models: [
      {
        id: 'moonshot-v1-8k',
        name: 'Moonshot V1 8K',
        description: '8K 上下文版本',
        maxContextLength: 8192,
        inputPrice: 0.5,
        outputPrice: 0.5,
      },
      {
        id: 'moonshot-v1-32k',
        name: 'Moonshot V1 32K',
        description: '32K 上下文版本',
        maxContextLength: 32768,
        inputPrice: 1.0,
        outputPrice: 1.0,
      },
      {
        id: 'moonshot-v1-128k',
        name: 'Moonshot V1 128K',
        description: '128K 超长上下文版本',
        maxContextLength: 131072,
        inputPrice: 2.0,
        outputPrice: 2.0,
      },
    ],
  },

  // 智谱 AI (GLM)
  {
    id: 'zhipu',
    name: '智谱 AI (GLM)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    description: '智谱 AI GLM 系列大模型',
    website: 'https://open.bigmodel.cn',
    docsUrl: 'https://open.bigmodel.cn/dev/api',
    isPreset: true,
    models: [
      {
        id: 'glm-4-plus',
        name: 'GLM-4 Plus',
        description: '增强版对话模型',
        supportsFunctionCall: true,
        supportsVision: true,
        maxContextLength: 128000,
        inputPrice: 3.5,
        outputPrice: 3.5,
      },
      {
        id: 'glm-4-air',
        name: 'GLM-4 Air',
        description: '轻量版对话模型',
        maxContextLength: 128000,
        inputPrice: 0.14,
        outputPrice: 0.14,
      },
      {
        id: 'glm-4-flash',
        name: 'GLM-4 Flash',
        description: '快速版对话模型，免费',
        maxContextLength: 128000,
        inputPrice: 0,
        outputPrice: 0,
      },
      {
        id: 'glm-4-long',
        name: 'GLM-4 Long',
        description: '长上下文模型',
        maxContextLength: 1048576,
        inputPrice: 0.14,
        outputPrice: 0.14,
      },
    ],
  },

  // 通义千问 (Qwen)
  {
    id: 'qwen',
    name: '通义千问 (Qwen)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    description: '阿里云通义千问大模型',
    website: 'https://tongyi.aliyun.com',
    docsUrl: 'https://help.aliyun.com/document_detail/2400395.html',
    isPreset: true,
    models: [
      {
        id: 'qwen-turbo',
        name: 'Qwen Turbo',
        description: '快速响应模型',
        maxContextLength: 131072,
        inputPrice: 0.3,
        outputPrice: 0.6,
      },
      {
        id: 'qwen-plus',
        name: 'Qwen Plus',
        description: '增强版模型',
        supportsFunctionCall: true,
        supportsVision: true,
        maxContextLength: 131072,
        inputPrice: 0.8,
        outputPrice: 2.0,
      },
      {
        id: 'qwen-max',
        name: 'Qwen Max',
        description: '旗舰版模型',
        supportsFunctionCall: true,
        supportsVision: true,
        supportsThinking: true,
        maxContextLength: 32768,
        inputPrice: 2.4,
        outputPrice: 9.6,
      },
      {
        id: 'qwen-coder-plus',
        name: 'Qwen Coder Plus',
        description: '代码专用模型',
        maxContextLength: 131072,
        inputPrice: 0.35,
        outputPrice: 0.7,
      },
    ],
  },

  // 百川智能
  {
    id: 'baichuan',
    name: '百川智能',
    baseUrl: 'https://api.baichuan-ai.com/v1',
    description: '百川智能大模型',
    website: 'https://www.baichuan-ai.com',
    docsUrl: 'https://platform.baichuan-ai.com/docs/api',
    isPreset: true,
    models: [
      {
        id: 'Baichuan4',
        name: 'Baichuan 4',
        description: '旗舰版模型',
        supportsFunctionCall: true,
        maxContextLength: 128000,
        inputPrice: 2.5,
        outputPrice: 2.5,
      },
      {
        id: 'Baichuan3-Turbo',
        name: 'Baichuan 3 Turbo',
        description: '快速版模型',
        maxContextLength: 32000,
        inputPrice: 0.25,
        outputPrice: 0.25,
      },
    ],
  },

  // MiniMax
  {
    id: 'minimax',
    name: 'MiniMax',
    baseUrl: 'https://api.minimax.chat/v1',
    description: 'MiniMax 大模型',
    website: 'https://www.minimaxi.com',
    docsUrl: 'https://www.minimaxi.com/document',
    isPreset: true,
    customHeaders: {
      'X-API-Key': '', // 需要设置
    },
    models: [
      {
        id: 'abab6.5-chat',
        name: 'ABAB 6.5 Chat',
        description: '对话模型',
        supportsFunctionCall: true,
        maxContextLength: 245000,
        inputPrice: 2.0,
        outputPrice: 2.0,
      },
      {
        id: 'abab6.5s-chat',
        name: 'ABAB 6.5s Chat',
        description: '快速版对话模型',
        maxContextLength: 245000,
        inputPrice: 0.35,
        outputPrice: 0.35,
      },
    ],
  },

  // 零一万物 (Yi)
  {
    id: 'yi',
    name: '零一万物 (Yi)',
    baseUrl: 'https://api.lingyiwanwu.com/v1',
    description: '零一万物 Yi 系列大模型',
    website: 'https://platform.lingyiwanwu.com',
    docsUrl: 'https://platform.lingyiwanwu.com/docs',
    isPreset: true,
    models: [
      {
        id: 'yi-large',
        name: 'Yi Large',
        description: '大规模版本',
        maxContextLength: 32768,
        inputPrice: 2.5,
        outputPrice: 2.5,
      },
      {
        id: 'yi-medium',
        name: 'Yi Medium',
        description: '中等规模版本',
        maxContextLength: 16384,
        inputPrice: 0.25,
        outputPrice: 0.25,
      },
      {
        id: 'yi-spark',
        name: 'Yi Spark',
        description: '快速响应版本',
        maxContextLength: 16384,
        inputPrice: 0.12,
        outputPrice: 0.12,
      },
    ],
  },

  // SiliconFlow (多模型聚合)
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    description: 'SiliconFlow 多模型聚合平台',
    website: 'https://siliconflow.cn',
    docsUrl: 'https://docs.siliconflow.cn',
    isPreset: true,
    models: [
      {
        id: 'Qwen/Qwen2.5-72B-Instruct',
        name: 'Qwen 2.5 72B',
        description: 'Qwen 2.5 72B Instruct',
        maxContextLength: 32768,
        inputPrice: 0.4,
        outputPrice: 0.4,
      },
      {
        id: 'deepseek-ai/DeepSeek-V2.5',
        name: 'DeepSeek V2.5',
        description: 'DeepSeek V2.5',
        maxContextLength: 32768,
        inputPrice: 0.14,
        outputPrice: 0.28,
      },
    ],
  },

  // OpenAI (官方)
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    description: 'OpenAI 官方 API',
    website: 'https://openai.com',
    docsUrl: 'https://platform.openai.com/docs',
    isPreset: true,
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: '最新旗舰模型',
        supportsFunctionCall: true,
        supportsVision: true,
        maxContextLength: 128000,
        inputPrice: 2.5,
        outputPrice: 10.0,
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: '轻量版模型',
        supportsFunctionCall: true,
        supportsVision: true,
        maxContextLength: 128000,
        inputPrice: 0.15,
        outputPrice: 0.6,
      },
      {
        id: 'o1-preview',
        name: 'o1 Preview',
        description: '推理增强模型',
        supportsThinking: true,
        maxContextLength: 128000,
        inputPrice: 15.0,
        outputPrice: 60.0,
      },
    ],
  },

  // 自定义 Provider（用户自定义）
  {
    id: 'custom',
    name: '自定义 Provider',
    baseUrl: '',
    description: '自定义 OpenAI 兼容 API',
    isPreset: false,
    models: [],
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 根据 ID 获取预设 Provider
 */
export function getPresetProviderById(id: string): ModelProvider | undefined {
  return PRESET_PROVIDERS.find(p => p.id === id);
}

/**
 * 获取所有启用的预设 Provider
 */
export function getEnabledPresetProviders(): ModelProvider[] {
  return PRESET_PROVIDERS.filter(p => p.enabled !== false);
}

/**
 * 根据 Provider ID 和模型 ID 获取模型信息
 */
export function getModelById(providerId: string, modelId: string): ProviderModel | undefined {
  const provider = getPresetProviderById(providerId);
  return provider?.models.find(m => m.id === modelId);
}

/**
 * 验证 Provider 配置
 */
export function validateProviderConfig(provider: Partial<ModelProvider>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!provider.id || provider.id.trim() === '') {
    errors.push('Provider ID is required');
  }

  if (!provider.name || provider.name.trim() === '') {
    errors.push('Provider name is required');
  }

  if (!provider.baseUrl || provider.baseUrl.trim() === '') {
    errors.push('Base URL is required');
  } else {
    try {
      new URL(provider.baseUrl);
    } catch {
      errors.push('Invalid base URL format');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Export
// ============================================================================

export default PRESET_PROVIDERS;
