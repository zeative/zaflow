import { ModelConfig } from '../../types/core';
import { Provider as IProvider, ProviderMessage, ProviderResponse } from '../../types/provider';
import { Tool } from '../../types/tool';

export abstract class BaseProvider implements IProvider {
  abstract name: string;
  abstract type: string;
  defaultModel?: string;

  abstract chat(messages: ProviderMessage[], config: ModelConfig, tools?: Tool[]): Promise<ProviderResponse>;

  abstract stream?(messages: ProviderMessage[], config: ModelConfig, tools?: Tool[]): AsyncIterableIterator<string>;

  protected mergeConfig(defaultConfig?: ModelConfig, override?: ModelConfig): ModelConfig {
    return { ...defaultConfig, ...override };
  }
}
