import type { Tool } from './tool';
import type { ModelConfig } from './core';

/**
 * Tool call structure
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
}

/**
 * Provider response
 */
export interface ProviderResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls?: ToolCall[];
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}

/**
 * Message for provider
 */
export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

/**
 * Provider adapter function
 */
export type ProviderAdapter = (messages: ProviderMessage[], config: ModelConfig, tools?: Tool[]) => Promise<ProviderResponse>;

/**
 * Rate limit configuration
 */
export interface RateLimit {
  requestsPerMinute?: number;
  tokensPerMinute?: number;
}

/**
 * Provider definition
 */
export interface ProviderDefinition {
  /** Provider name */
  name: string;
  /** Provider type */
  type: 'groq' | 'ollama' | 'openai' | 'custom';
  /** API key (if required) */
  apiKey?: string;
  /** Base URL (if custom) */
  baseURL?: string;
  /** Default model */
  defaultModel?: string;
  /** Custom adapter (for type: 'custom') */
  adapter?: ProviderAdapter;
  /** Request timeout */
  timeout?: number;
  /** Rate limiting */
  rateLimit?: RateLimit;
}

/**
 * Provider interface
 */
export interface Provider {
  name: string;
  type: string;
  defaultModel?: string;

  /**
   * Send chat completion request
   */
  chat(messages: ProviderMessage[], config: ModelConfig, tools?: Tool[]): Promise<ProviderResponse>;

  /**
   * Stream chat completion
   */
  stream?(messages: ProviderMessage[], config: ModelConfig, tools?: Tool[]): AsyncIterableIterator<string>;
}
