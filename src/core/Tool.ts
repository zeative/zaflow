import type { z } from 'zod';
import { zodToJsonSchema } from '../protocol/SchemaConverter';
import type { MediaType } from '../types/content';
import type { RetryConfig } from '../types/optimization';
import type { Tool as ITool, ToolContext, ToolDefinition } from '../types/tool';
import { retryWithBackoff } from '../utils/retry';
import { validate } from '../utils/validator';

/**
 * Tool implementation
 */
export class Tool<TSchema extends z.ZodSchema = any> implements ITool<TSchema> {
  name: string;
  description: string;
  schema: TSchema;
  execute: (args: z.infer<TSchema>, context: ToolContext) => Promise<any>;
  cache?: boolean | number;
  retry?: RetryConfig;
  handles?: MediaType[]; // 🔥 Multimodal support
  priority?: number; // 🔥 Tool priority

  // Internal cache
  private cacheStore: Map<string, { value: any; expiry?: number }> = new Map();

  constructor(definition: ToolDefinition<TSchema>) {
    this.name = definition.name;
    this.description = definition.description;
    this.schema = definition.schema;
    this.execute = async (args, context) => {
      return await definition.execute(args, context);
    };
    this.cache = definition.cache;
    this.retry = definition.retry;
    this.handles = definition.handles; // 🔥
    this.priority = definition.priority; // 🔥
  }

  /**
   * Execute tool with validation, caching, and retry support
   */
  async run(args: any, context: ToolContext): Promise<any> {
    let validatedArgs;
    const validationResult = this.schema.safeParse(args);

    if (validationResult.success) {
      validatedArgs = validationResult.data;
    } else if (typeof args === 'object' && args !== null && Object.keys(args).length === 0) {
      // Try null fallback for empty object
      const nullResult = this.schema.safeParse(null);
      if (nullResult.success) {
        validatedArgs = nullResult.data;
      } else {
        throw validationResult.error; // Throw original error if null also fails
      }
    } else {
      throw validationResult.error;
    }

    // Check cache
    if (this.cache) {
      const cacheKey = this.getCacheKey(validatedArgs);
      const cached = this.getCached(cacheKey);

      if (cached !== null) {
        return cached;
      }
    }

    // Execute with retry if configured
    const executor = async () => {
      return await this.execute(validatedArgs, context);
    };

    const result = this.retry ? await retryWithBackoff(executor, this.retry) : await executor();

    // Cache result
    if (this.cache) {
      const cacheKey = this.getCacheKey(validatedArgs);
      const ttl = typeof this.cache === 'number' ? this.cache : undefined;
      this.setCached(cacheKey, result, ttl);
    }

    return result;
  }

  /**
   * Convert schema to JSON Schema
   */
  toJSONSchema(): any {
    return zodToJsonSchema(this.schema);
  }

  /**
   * Generate cache key from arguments
   */
  private getCacheKey(args: any): string {
    return `${this.name}:${JSON.stringify(args)}`;
  }

  /**
   * Get cached value
   */
  private getCached(key: string): any | null {
    const item = this.cacheStore.get(key);

    if (!item) {
      return null;
    }

    // Check expiry
    if (item.expiry && Date.now() > item.expiry) {
      this.cacheStore.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Set cached value
   */
  private setCached(key: string, value: any, ttl?: number): void {
    const item: { value: any; expiry?: number } = { value };

    if (ttl) {
      item.expiry = Date.now() + ttl;
    }

    this.cacheStore.set(key, item);
  }
}
