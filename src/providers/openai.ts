import type { Message, ProviderConfig, ProviderOptions, ProviderResponse } from '../types';
import type { ChatCompletionResponse } from '../types/sdk';
import { BaseProvider } from './base';

type OpenAIClient = {
  chat: { completions: { create: (p: unknown) => Promise<ChatCompletionResponse> } };
};

export class OpenAIProvider extends BaseProvider {
  name = 'openai';
  private client: OpenAIClient | null = null;

  constructor(config: ProviderConfig & { apiKey: string }) {
    super({ ...config, model: config.model ?? 'gpt-4o-mini' });
  }

  private async getClient(): Promise<OpenAIClient> {
    if (this.client) return this.client;
    const { default: OpenAI } = await import('openai');
    this.client = new OpenAI({ apiKey: this.config.apiKey, baseURL: this.config.baseUrl }) as unknown as OpenAIClient;
    return this.client;
  }

  async chat(messages: Message[], options?: ProviderOptions): Promise<ProviderResponse> {
    const c = await this.getClient();
    const o = this.mergeOptions(options);
    const tools = this.toolsToFunctions(o.tools);

    const r = await c.chat.completions.create({
      model: o.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content, name: m.name, tool_call_id: m.tool_call_id, tool_calls: m.tool_calls })),
      temperature: o.temperature,
      max_tokens: o.maxTokens,
      tools,
      tool_choice: tools ? 'auto' : undefined,
    });

    const ch = r.choices[0];
    return {
      content: ch.message.content,
      toolCalls: ch.message.tool_calls,
      finishReason: ch.finish_reason === 'tool_calls' ? 'tool_calls' : ch.finish_reason === 'length' ? 'length' : 'stop',
      usage: r.usage ? { promptTokens: r.usage.prompt_tokens, completionTokens: r.usage.completion_tokens, totalTokens: r.usage.total_tokens } : undefined,
    };
  }
}
