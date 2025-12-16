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

export function defineTool<T extends z.ZodType>(input: DefineToolInput<T>): ToolDefinition<T> {
  return {
    name: input.name,
    description: input.description,
    schema: input.schema,
    handler: input.handler,
    handles: input.handles,
    config: {
      timeout: input.config?.timeout ?? 30000,
      cacheable: input.config?.cacheable ?? false,
      cacheTTL: input.config?.cacheTTL ?? 300000,
      retryable: input.config?.retryable ?? true,
      maxRetries: input.config?.maxRetries ?? 3,
      dependsOn: input.config?.dependsOn,
      cacheKey: input.config?.cacheKey,
      keywords: input.config?.keywords,
    },
  };
}
