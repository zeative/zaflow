import { BaseProvider } from '../core/entities/Provider';
import { ModelConfig } from '../types/core';
import { Provider, ProviderAdapter, ProviderDefinition, ProviderMessage, ProviderResponse } from '../types/provider';
import { Tool } from '../types/tool';

export class CustomProvider extends BaseProvider implements Provider {
  name: string;
  type = 'custom';
  declare defaultModel?: string;
  readonly supportsNativeTools: boolean;
  readonly supportsVision: boolean;
  private adapter: ProviderAdapter;

  constructor(definition: ProviderDefinition) {
    super();

    if (!definition.adapter) {
      throw new Error('Custom provider requires an adapter function');
    }

    this.name = definition.name;
    this.defaultModel = definition.defaultModel;
    this.adapter = definition.adapter;
    this.supportsNativeTools = definition.supportsNativeTools ?? false;
    this.supportsVision = definition.supportsVision ?? false;
  }

  async chat(messages: ProviderMessage[], config: ModelConfig, tools?: Tool[]): Promise<ProviderResponse> {
    return await this.adapter(messages, config, tools);
  }

  async *stream(messages: ProviderMessage[], config: ModelConfig, tools?: Tool[]): AsyncIterableIterator<string> {
    throw new Error('Streaming is not supported for custom providers.');
  }
}
