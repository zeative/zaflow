import type { z } from 'zod';
import type { Tool } from './tool';
import type { Agent } from './agent';
import type { Provider } from './provider';
import type { Hooks } from './hooks';
import type { StoragePlugin } from './storage';
import type { OptimizationConfig, RetryConfig } from './optimization';

/**
 * Message role types
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Message structure
 */
export interface Message {
  role: MessageRole;
  content: string;
  name?: string; // For tool messages
  toolCallId?: string; // For tool responses
}

/**
 * Model configuration
 */
export interface ModelConfig {
  /** Temperature (0.0 - 2.0) */
  temperature?: number;
  /** Maximum completion tokens */
  maxTokens?: number;
  /** Top-p sampling (0.0 - 1.0) */
  topP?: number;
  /** Top-k sampling */
  topK?: number;
  /** Frequency penalty (-2.0 - 2.0) */
  frequencyPenalty?: number;
  /** Presence penalty (-2.0 - 2.0) */
  presencePenalty?: number;
  /** Stop sequences */
  stopSequences?: string[];
  /** Enable streaming */
  stream?: boolean;
}

/**
 * History configuration
 */
export interface HistoryConfig {
  /** Maximum messages to keep */
  maxMessages?: number;
  /** Maximum tokens in history */
  maxTokens?: number;
  /** Summarize old messages */
  summarizeOld?: boolean;
  /** Strategy for history management */
  strategy?: 'sliding' | 'summarize' | 'hybrid';
  /** Keep system message */
  keepSystemMessage?: boolean;
}

/**
 * Execution mode
 */
export type ExecutionMode = 'single' | 'agentic' | 'autonomous';

/**
 * ZaFlow constructor options
 */
export interface ZaFlowOptions<TContext = any> {
  /** Execution mode */
  mode: ExecutionMode;
  /** Provider instance */
  provider: Provider;
  /** Sub-agents (for autonomous mode) */
  agents?: Agent[];
  /** Tools (for agentic/autonomous mode) */
  tools?: Tool[];
  /** Model configuration */
  config?: ModelConfig;
  /** History management */
  historyConfig?: HistoryConfig;
  /** Storage plugin */
  storage?: StoragePlugin;
  /** Event hooks */
  hooks?: Hooks;
  /** Retry configuration */
  retryConfig?: RetryConfig;
  /** Token optimization */
  optimization?: OptimizationConfig;
  /** System prompt override */
  systemPrompt?: string;
}

/**
 * Run options
 */
export interface RunOptions {
  /** Override model config for this run */
  config?: Partial<ModelConfig>;
  /** Structured output schema */
  schema?: z.ZodSchema;
  /** Return detailed response */
  detailed?: boolean;
  /** Skip context clearing after run */
  persistContext?: boolean;
  /** Override system prompt for this run */
  systemPrompt?: string;
}

/**
 * Stream options
 */
export interface StreamOptions {
  /** Override model config for this run */
  config?: Partial<ModelConfig>;
  /** Skip context clearing after run */
  persistContext?: boolean;
  /** Override system prompt for this stream */
  systemPrompt?: string;
}

/**
 * Token usage metadata
 */
export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

/**
 * Execution metadata
 */
export interface ExecutionMetadata {
  tokensUsed: TokenUsage;
  toolsCalled: string[];
  agentsCalled: string[];
  executionTime: number; // milliseconds
  model: string;
}

/**
 * Error response
 */
export interface ErrorResponse {
  message: string;
  code: string;
  details?: any;
}

/**
 * ZaFlow response
 */
export interface ZaFlowResponse {
  /** Response content */
  content: string;
  /** Metadata (if detailed: true) */
  metadata?: ExecutionMetadata;
  /** Error (if any) */
  error?: ErrorResponse;
}
