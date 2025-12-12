import * as z from 'zod';
import type { Message, ProviderConfig, ProviderInterface, ProviderOptions, ProviderResponse, ToolDefinition } from '../types';

export abstract class BaseProvider implements ProviderInterface {
  abstract name: string;
  protected config: ProviderConfig;

  constructor(config: ProviderConfig = {}) {
    this.config = config;
  }

  abstract chat(messages: Message[], options?: ProviderOptions): Promise<ProviderResponse>;

  protected mergeOptions(o?: ProviderOptions): ProviderOptions {
    const d = this.config.defaultOptions;
    return {
      model: o?.model ?? this.config.model ?? d?.model,
      temperature: o?.temperature ?? d?.temperature,
      maxTokens: o?.maxTokens ?? d?.maxTokens,
      tools: o?.tools ?? d?.tools,
      stream: o?.stream ?? d?.stream,
      signal: o?.signal,
    };
  }

  protected toolsToFunctions(tools?: ToolDefinition[]) {
    if (!tools?.length) return undefined;
    return tools.map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: z.toJSONSchema(t.schema) } }));
  }
}
