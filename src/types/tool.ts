import type { z } from 'zod';
import type { Message } from './core';
import type { RetryConfig } from './optimization';
import type { MediaType } from './content';

/**
 * Storage interface for tool context
 */
export interface StorageInterface {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Shared memory for inter-agent communication
 */
export interface SharedMemory {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
  has(key: string): Promise<boolean>;
}

/**
 * Tool context provided to tool execution
 */
export interface ToolContext<TContext = any> {
  /** User-provided context */
  userContext: TContext;
  /** Shared memory across agents */
  sharedMemory: SharedMemory;
  /** Agent that called this tool */
  agentName: string;
  /** Conversation history */
  conversationHistory: Message[];
  /** Current execution metadata */
  metadata: {
    executionId: string;
    timestamp: number;
    mode: 'single' | 'agentic' | 'autonomous';
  };
  /** Storage access */
  storage: StorageInterface;
}

/**
 * Tool definition with multimodal support
 */
export interface ToolDefinition<TSchema extends z.ZodSchema = any> {
  /** Tool name (unique identifier) */
  name: string;
  /** Tool description (for AI to understand) */
  description: string;
  /** Zod schema for parameters */
  schema: TSchema;
  /** Execution function */
  execute: (args: z.infer<TSchema>, context: ToolContext) => Promise<any> | any;
  /** Optional: Cache results */
  cache?: boolean | number; // true or TTL in ms
  /** Optional: Retry config */
  retry?: RetryConfig;
  /** 🔥 Media types this tool can handle (for auto-detection) */
  handles?: MediaType[];
  /** 🔥 Priority for conflict resolution (higher = preferred) */
  priority?: number;
}

/**
 * Tool interface
 */
export interface Tool<TSchema extends z.ZodSchema = any> {
  name: string;
  description: string;
  schema: TSchema;
  execute: (args: z.infer<TSchema>, context: ToolContext) => Promise<any>;
  cache?: boolean | number;
  retry?: RetryConfig;
  handles?: MediaType[]; // 🔥 Multimodal support
  priority?: number; // 🔥 Tool priority

  /**
   * Execute tool with validation, caching, and retry support
   */
  run(args: any, context: ToolContext): Promise<any>;

  /**
   * Convert schema to JSON Schema format
   */
  toJSONSchema(): any;
}
