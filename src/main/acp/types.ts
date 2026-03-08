/**
 * ACP (Agent Communication Protocol) Types
 * JSON-RPC 2.0 over stdin/stdout
 */

// ============================================================================
// JSON-RPC 2.0 Base Types
// ============================================================================

// AgentInfo 类型定义
export interface AgentInfo {
  agentId: string;
  agentIndex?: number;
  taskId?: string;
  timestamp?: number;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

// ============================================================================
// ACP Method Constants (iFlow CLI 实际使用的方法名)
// ============================================================================

export const ACP_METHODS = {
  INITIALIZE: 'initialize',
  SESSION_LOAD: 'session/load',  // iflow cli uses session/load
  SESSION_PROMPT: 'session/prompt',
  SESSION_SET_MODE: 'session/set_mode',
  SESSION_SET_CONFIG_OPTION: 'session/set_config_option',  // ACP 标准方法，用于设置 model、deepThinking 等
  // 以下方法在 ACP 协议中不存在，保留用于本地状态管理
  SESSION_SET_MODEL: 'session/set_model',
  SESSION_SET_DEEP_THINKING: 'session/set_deep_thinking',
} as const;

// ============================================================================
// ACP Request/Response Types
// ============================================================================

export interface AcpInitializeParams {
  protocolVersion: string;
  clientInfo: {
    name: string;
    version: string;
  };
  capabilities?: Record<string, unknown>;
}

export interface AcpInitializeResult {
  protocolVersion: string;
  serverInfo: {
    name: string;
    version: string;
  };
  capabilities?: Record<string, unknown>;
}

export interface AcpNewSessionParams {
  sessionId?: string;  // Optional: if provided, load existing session; otherwise create new
  workingDir?: string;
  options?: {
    mode?: string;
    model?: string;
    deepThinking?: boolean;
    deepThinkingLevel?: number;
  };
}

export interface AcpNewSessionResult {
  sessionId: string;
  modes?: {
    currentModeId: string;
    availableModes: Array<{
      id: string;
      name: string;
      description: string;
    }>;
  };
  _meta?: {
    models?: {
      currentModelId: string;
      availableModels: Array<{
        id: string;
        name: string;
        description: string;
        capabilities?: { thinking?: boolean };
      }>;
    };
    availableCommands?: Array<{
      name: string;
      description: string;
    }>;
  };
  // For error cases
  error?: string;
}

export interface AcpPromptParams {
  sessionId: string;
  prompt: Array<{ type: 'text'; text: string }>;
  attachments?: Array<{
    type: string;
    name: string;
    content: string;
  }>;
}

export interface AcpPromptResult {
  messageId: string;
  status: 'accepted' | 'error';
  error?: string;
}

export interface AcpSetModeParams {
  mode: string;
}

export interface AcpSetModeResult {
  success: boolean;
  previousMode: string;
  currentMode: string;
}

export interface AcpSetModelParams {
  model: string;
}

export interface AcpSetModelResult {
  success: boolean;
  previousModel: string;
  currentModel: string;
  serverSynced: boolean;
}

export interface AcpSetDeepThinkingParams {
  enabled: boolean;
  level?: number;
}

export interface AcpSetDeepThinkingResult {
  success: boolean;
  enabled: boolean;
  level: number;
  serverSynced?: boolean;
}

// ============================================================================
// Session Update Notifications (Streaming Responses)
// ============================================================================

// Base interface for all session updates
export interface BaseSessionUpdate {
  sessionId: string;
}

// ===== AionUi-compatible session update types =====

/** Agent message chunk update */
export interface AgentMessageChunkUpdate extends BaseSessionUpdate {
  update: {
    sessionUpdate: 'agent_message_chunk';
    content: {
      type: 'text' | 'image';
      text?: string;
      data?: string;
      mimeType?: string;
      uri?: string;
    };
    agentInfo?: AgentInfo;  // 添加 agentInfo 字段
  };
}

/** Agent thought chunk update */
export interface AgentThoughtChunkUpdate extends BaseSessionUpdate {
  update: {
    sessionUpdate: 'agent_thought_chunk';
    content: {
      type: 'text';
      text: string;
    };
  };
}

// Shared sub-types
export interface ToolCallContentItem {
  type: 'content' | 'diff';
  content?: {
    type: 'text';
    text: string;
  };
  path?: string;
  oldText?: string | null;
  newText?: string;
}

export interface ToolCallLocationItem {
  path: string;
}

/** Tool call update */
export interface ToolCallUpdate extends BaseSessionUpdate {
  update: {
    sessionUpdate: 'tool_call';
    toolCallId: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    title: string;
    kind: 'read' | 'edit' | 'execute';
    rawInput?: Record<string, unknown>;
    content?: ToolCallContentItem[];
    locations?: ToolCallLocationItem[];
    agentInfo?: AgentInfo;  // 添加 agentInfo 字段
  };
}

/** Tool call status update */
export interface ToolCallUpdateStatus extends BaseSessionUpdate {
  update: {
    sessionUpdate: 'tool_call_update';
    toolCallId: string;
    status: 'completed' | 'failed';
    content?: Array<{
      type: 'content';
      content: {
        type: 'text';
        text: string;
      };
    }>;
  };
}

/** Plan update */
export interface PlanUpdate extends BaseSessionUpdate {
  update: {
    sessionUpdate: 'plan';
    entries: Array<{
      content: string;
      status: 'pending' | 'in_progress' | 'completed';
      priority?: 'low' | 'medium' | 'high';
    }>;
  };
}

/** Available commands update */
export interface AvailableCommandsUpdate extends BaseSessionUpdate {
  update: {
    sessionUpdate: 'available_commands_update';
    availableCommands: Array<{
      name: string;
      description: string;
      input?: {
        hint?: string;
      } | null;
    }>;
  };
}

/** User message chunk update */
export interface UserMessageChunkUpdate extends BaseSessionUpdate {
  update: {
    sessionUpdate: 'user_message_chunk';
    content: {
      type: 'text' | 'image';
      text?: string;
      data?: string;
      mimeType?: string;
      uri?: string;
    };
  };
}

/** Config options update */
export interface ConfigOptionsUpdatePayload extends BaseSessionUpdate {
  update: {
    sessionUpdate: 'config_option_update';
    configOptions: AcpSessionConfigOption[];
  };
}

// ===== Legacy session update format (for backward compatibility) =====

export type SessionUpdateType = 
  | 'agent_message_chunk'
  | 'agent_thought_chunk'
  | 'tool_call'
  | 'tool_result'
  | 'plan'
  | 'plan_progress'
  | 'error'
  | 'complete';

export interface LegacySessionUpdate {
  type: SessionUpdateType;
  sessionId: string;
  messageId: string;
  timestamp: string;
  data: unknown;
}

// ===== Union type for all possible session updates =====

export type AionUiSessionUpdate = 
  | AgentMessageChunkUpdate 
  | AgentThoughtChunkUpdate 
  | ToolCallUpdate 
  | ToolCallUpdateStatus 
  | PlanUpdate 
  | AvailableCommandsUpdate 
  | UserMessageChunkUpdate 
  | ConfigOptionsUpdatePayload;

export type SessionUpdate = LegacySessionUpdate | AionUiSessionUpdate;

// ===== ACP Session Config Option types =====

export interface AcpSessionConfigOption {
  id: string;
  name?: string;
  label?: string;
  description?: string;
  category?: string;
  type: 'select' | 'boolean' | 'string';
  currentValue?: string;
  selectedValue?: string;
  options?: AcpConfigSelectOption[];
}

export interface AcpConfigSelectOption {
  value: string;
  name?: string;
  label?: string;
}

export interface AgentMessageChunkData {
  content: string;
  isComplete: boolean;
  agentInfo?: AgentInfo;  // 添加 agentInfo 字段
}

export interface AgentThoughtChunkData {
  content: string;
  thoughtId: string;
}

export interface ToolCallData {
  toolId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  agentInfo?: AgentInfo;  // 添加 agentInfo 字段
}

export interface ToolResultData {
  toolId: string;
  status: 'success' | 'error';
  result?: unknown;
  error?: string;
}

export interface PlanData {
  planId: string;
  title: string;
  steps: Array<{
    stepId: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'error';
  }>;
}

export interface PlanProgressData {
  planId: string;
  stepId: string;
  status: 'in_progress' | 'completed' | 'error';
  message?: string;
}

export interface ErrorData {
  code: string;
  message: string;
  details?: unknown;
}

export interface CompleteData {
  messageId: string;
  totalTokens?: number;
  finishReason: 'stop' | 'length' | 'error';
}

// ============================================================================
// Supported Models and Modes
// ============================================================================

export const SUPPORTED_MODELS = [
  'GLM-4.7',
  'iFlow-ROME-30BA3B',
  'DeepSeek-V3.2',
  'GLM-5',
  'Qwen3-Coder-Plus',
  'Kimi-K2-Thinking',
  'MiniMax-M2.5',
  'Kimi-K2.5',
  'Kimi-K2-0905'
] as const;

export const SUPPORTED_MODES = ['YOLO', 'Plan', 'Smart', 'Ask'] as const;

export type SupportedModel = typeof SUPPORTED_MODELS[number];
export type SupportedMode = typeof SUPPORTED_MODES[number];

// ============================================================================
// Connection States
// ============================================================================

export type AcpConnectionState = 
  | 'disconnected'
  | 'connecting'
  | 'initializing'
  | 'connected'
  | 'error';

export interface AcpConnectionOptions {
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  port?: number;
  host?: string;
}
