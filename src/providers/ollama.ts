import type { Message, ProviderConfig, ProviderOptions, ProviderResponse } from '../types';
import type { OllamaChatResponse } from '../types/sdk';
import { BaseProvider } from './base';

type OllamaClient = {
  chat: (p: unknown) => Promise<OllamaChatResponse>;
};

export class OllamaProvider extends BaseProvider {
  name = 'ollama';
  private client: OllamaClient | null = null;

  constructor(config: Omit<ProviderConfig, 'apiKey'> & { host?: string } = {}) {
    super({ ...config, baseUrl: config.host ?? 'http://localhost:11434', model: config.model ?? 'llama3.2' });
  }

  private async getClient(): Promise<OllamaClient> {
    if (this.client) return this.client;
    const { Ollama } = await import('ollama');
    this.client = new Ollama({ host: this.config.baseUrl }) as unknown as OllamaClient;
    return this.client;
  }

  async chat(messages: Message[], options?: ProviderOptions): Promise<ProviderResponse> {
    const c = await this.getClient();
    const o = this.mergeOptions(options);
    const tools = o.tools?.length ? this.toolsToFunctions(o.tools) : undefined;

    const r = await c.chat({
      model: o.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      options: { temperature: o.temperature, num_predict: o.maxTokens },
      tools: tools?.map((t) => ({ type: t.type, function: t.function })),
    });

    const tc = r.message.tool_calls?.map((t, i) => ({
      id: `call_${i}`,
      type: 'function' as const,
      function: { name: t.function.name, arguments: JSON.stringify(t.function.arguments) },
    }));

    return {
      content: r.message.content,
      toolCalls: tc,
      finishReason: tc?.length ? 'tool_calls' : 'stop',
      usage: { promptTokens: r.prompt_eval_count ?? 0, completionTokens: r.eval_count ?? 0, totalTokens: (r.prompt_eval_count ?? 0) + (r.eval_count ?? 0) },
    };
  }
}
