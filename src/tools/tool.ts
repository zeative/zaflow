import type { MediaType, ToolConfig, ToolDefinition, ToolHandler } from '../types';
import type { z } from 'zod';

type DefineToolInput<T extends z.ZodType> = {
  name: string;
  description: string;
  schema: T;
  handler: ToolHandler<z.infer<T>>;
  config?: ToolConfig;
  handles?: MediaType[];
};

export function defineTool<T extends z.ZodType>(i: DefineToolInput<T>): ToolDefinition<T> {
  return {
    name: i.name,
    description: i.description,
    schema: i.schema,
    handler: i.handler,
    handles: i.handles,
    config: {
      timeout: i.config?.timeout ?? 30000,
      cacheable: i.config?.cacheable ?? false,
      cacheTTL: i.config?.cacheTTL ?? 300000,
      retryable: i.config?.retryable ?? true,
      maxRetries: i.config?.maxRetries ?? 3,
      dependsOn: i.config?.dependsOn,
      cacheKey: i.config?.cacheKey,
      keywords: i.config?.keywords,
    },
  };
}
