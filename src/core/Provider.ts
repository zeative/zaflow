import type { ModelConfig } from '../types/core';
import type { Provider as IProvider, ProviderMessage, ProviderResponse } from '../types/provider';
import type { Tool } from '../types/tool';

/**
 * Abstract base class for providers
 */
export abstract class BaseProvider implements IProvider {
  abstract name: string;
  abstract type: string;
  defaultModel?: string;

  /**
   * Send chat completion request
   */
  abstract chat(messages: ProviderMessage[], config: ModelConfig, tools?: Tool[]): Promise<ProviderResponse>;

  /**
   * Stream chat completion (optional)
   */
  abstract stream?(messages: ProviderMessage[], config: ModelConfig, tools?: Tool[]): AsyncIterableIterator<string>;

  /**
   * Merge default and override configs
   */
  protected mergeConfig(defaultConfig?: ModelConfig, override?: ModelConfig): ModelConfig {
    return { ...defaultConfig, ...override };
  }
}
