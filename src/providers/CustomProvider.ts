import type { Provider, ProviderAdapter, ProviderDefinition } from '../types/provider';
import { BaseProvider } from '../core/Provider';
import type { ProviderMessage, ProviderResponse } from '../types/provider';
import type { ModelConfig } from '../types/core';
import type { Tool } from '../types/tool';

/**
 * Custom provider implementation using adapter function
 */
export class CustomProvider extends BaseProvider implements Provider {
  name: string;
  type = 'custom';
  defaultModel?: string;
  private adapter: ProviderAdapter;

  constructor(definition: ProviderDefinition) {
    super();

    if (!definition.adapter) {
      throw new Error('Custom provider requires an adapter function');
    }

    this.name = definition.name;
    this.defaultModel = definition.defaultModel;
    this.adapter = definition.adapter;
  }

  async chat(messages: ProviderMessage[], config: ModelConfig, tools?: Tool[]): Promise<ProviderResponse> {
    return await this.adapter(messages, config, tools);
  }
}
