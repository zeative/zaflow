import type { z } from 'zod';
import { zodToJsonSchema } from '../../protocol/SchemaConverter';
import type { MediaType } from '../../types/content';
import type { RetryConfig } from '../../types/optimization';
import type { Tool as ITool, ToolContext, ToolDefinition } from '../../types/tool';
import { retryWithBackoff } from '../../utils/system/retry';

export class Tool<TSchema extends z.ZodSchema = any> implements ITool<TSchema> {
  name: string;
  description: string;
  schema: TSchema;
  execute: (args: z.infer<TSchema>, context: ToolContext) => Promise<any>;
  cache?: boolean | number;
  retry?: RetryConfig;
  handles?: MediaType[];
  priority?: number;

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
    this.handles = definition.handles;
    this.priority = definition.priority;
  }

  async run(args: any, context: ToolContext): Promise<any> {
    let validatedArgs;
    const validationResult = this.schema.safeParse(args);

    if (validationResult.success) {
      validatedArgs = validationResult.data;
    } else if (typeof args === 'object' && args !== null && Object.keys(args).length === 0) {
      const nullResult = this.schema.safeParse(null);
      if (nullResult.success) {
        validatedArgs = nullResult.data;
      } else {
        throw validationResult.error;
      }
    } else {
      throw validationResult.error;
    }

    if (this.cache) {
      const cacheKey = this.getCacheKey(validatedArgs);
      const cached = this.getCached(cacheKey);

      if (cached !== null) {
        return cached;
      }
    }

    const executor = async () => {
      return await this.execute(validatedArgs, context);
    };

    const result = this.retry ? await retryWithBackoff(executor, this.retry) : await executor();

    if (this.cache) {
      const cacheKey = this.getCacheKey(validatedArgs);
      const ttl = typeof this.cache === 'number' ? this.cache : undefined;
      this.setCached(cacheKey, result, ttl);
    }

    return result;
  }

  toJSONSchema(): any {
    return zodToJsonSchema(this.schema);
  }

  private getCacheKey(args: any): string {
    return `${this.name}:${JSON.stringify(args)}`;
  }

  private getCached(key: string): any | null {
    const item = this.cacheStore.get(key);

    if (!item) {
      return null;
    }

    if (item.expiry && Date.now() > item.expiry) {
      this.cacheStore.delete(key);
      return null;
    }

    return item.value;
  }

  private setCached(key: string, value: any, ttl?: number): void {
    const item: { value: any; expiry?: number } = { value };

    if (ttl) {
      item.expiry = Date.now() + ttl;
    }

    this.cacheStore.set(key, item);
  }
}
