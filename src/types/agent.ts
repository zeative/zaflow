import type { Tool } from './tool';
import type { ModelConfig } from './core';
import type { Provider } from './provider';

/**
 * Agent capabilities
 */
export type AgentCapability = string;

/**
 * Agent constraints
 */
export interface AgentConstraints {
  /** Maximum tool calls per execution */
  maxToolCalls?: number;
  /** Maximum execution time in milliseconds */
  maxExecutionTime?: number;
}

/**
 * Agent definition
 */
export interface AgentDefinition {
  /** Agent name (unique identifier) */
  name: string;
  /** Agent role (for auto-prompt generation) */
  role: string;
  /** Optional: Custom system prompt (overrides auto-generated) */
  systemPrompt?: string;
  /** Tools this agent can use */
  tools?: Tool[];
  /** Optional: Provider for this agent (if different from main provider) */
  provider?: Provider;
  /** Optional: Model for this agent (uses provider.defaultModel if not specified) */
  model?: string;
  /** Model configuration */
  config?: ModelConfig;
  /** Optional: Agent capabilities (for auto-routing) */
  capabilities?: AgentCapability[];
  /** Optional: Agent constraints */
  constraints?: AgentConstraints;
}

/**
 * Agent interface
 */
export interface Agent {
  name: string;
  role: string;
  systemPrompt?: string;
  tools?: Tool[];
  provider?: Provider;
  model?: string;
  config?: ModelConfig;
  capabilities?: AgentCapability[];
  constraints?: AgentConstraints;

  /**
   * Generate system prompt for this agent
   */
  getSystemPrompt(): string;

  /**
   * Check if agent has a capability
   */
  hasCapability(capability: string): boolean;

  /**
   * Get the model for this agent
   */
  getModel(): string;

  /**
   * Get the provider for this agent
   */
  getProvider(): Provider | undefined;
}
